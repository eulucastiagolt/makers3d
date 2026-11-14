use crate::api::Api;
use glib::translate::{FromGlibPtrFull, FromGlibPtrNone, ToGlibPtr};
use gtk4::{self as gtk, gio, glib, prelude::*};
use std::{
    ffi::{CStr, c_char, c_void},
    rc::Rc,
};

type Pointer = *mut c_void;
type Handler = unsafe extern "C" fn(Pointer, Pointer);

#[link(name = "webkitgtk-6.0")]
unsafe extern "C" {
    fn webkit_web_context_get_default() -> Pointer;
    fn webkit_web_context_get_security_manager(context: Pointer) -> Pointer;
    fn webkit_security_manager_register_uri_scheme_as_secure(
        manager: Pointer,
        scheme: *const c_char,
    );
    fn webkit_security_manager_register_uri_scheme_as_cors_enabled(
        manager: Pointer,
        scheme: *const c_char,
    );
    fn webkit_web_context_register_uri_scheme(
        context: Pointer,
        scheme: *const c_char,
        handler: Handler,
        data: Pointer,
        destroy: unsafe extern "C" fn(Pointer),
    );
    fn webkit_web_view_new() -> *mut gtk::ffi::GtkWidget;
    fn webkit_web_view_get_network_session(view: Pointer) -> Pointer;
    fn webkit_web_view_load_uri(view: Pointer, uri: *const c_char);
    fn webkit_uri_scheme_request_get_uri(request: Pointer) -> *const c_char;
    fn webkit_uri_scheme_request_get_http_method(request: Pointer) -> *const c_char;
    fn webkit_uri_scheme_request_get_http_body(request: Pointer) -> *mut gio::ffi::GInputStream;
    fn webkit_uri_scheme_request_finish_with_response(request: Pointer, response: Pointer);
    fn webkit_uri_scheme_response_new(
        stream: *mut gio::ffi::GInputStream,
        length: i64,
    ) -> *mut glib::gobject_ffi::GObject;
    fn webkit_uri_scheme_response_set_content_type(response: Pointer, content_type: *const c_char);
    fn webkit_uri_scheme_response_set_status(response: Pointer, status: u32, reason: *const c_char);
    fn webkit_download_set_destination(download: Pointer, destination: *const c_char);
    fn webkit_download_set_allow_overwrite(download: Pointer, allow: glib::ffi::gboolean);
    fn webkit_download_cancel(download: Pointer);
}

fn raw(object: &impl IsA<glib::Object>) -> Pointer {
    object.as_ref().as_ptr().cast()
}

fn send(request: &glib::Object, status: u32, mimetype: &CStr, body: &[u8]) {
    let bytes = glib::Bytes::from(body);
    let stream = gio::MemoryInputStream::from_bytes(&bytes).upcast::<gio::InputStream>();
    unsafe {
        let response = glib::Object::from_glib_full(webkit_uri_scheme_response_new(
            stream.to_glib_none().0,
            bytes.len() as i64,
        ));
        webkit_uri_scheme_response_set_content_type(raw(&response), mimetype.as_ptr());
        webkit_uri_scheme_response_set_status(raw(&response), status, std::ptr::null());
        webkit_uri_scheme_request_finish_with_response(raw(request), raw(&response));
    }
}

async fn read_body(stream: Option<gio::InputStream>) -> Result<Vec<u8>, &'static str> {
    let Some(stream) = stream else {
        return Ok(Vec::new());
    };
    let mut body = Vec::new();
    loop {
        let chunk = stream
            .read_bytes_future(64 * 1024, glib::Priority::DEFAULT)
            .await
            .map_err(|_| "Falha ao ler o arquivo.")?;
        if chunk.is_empty() {
            return Ok(body);
        }
        if body.len() + chunk.len() > 32 * 1024 * 1024 {
            return Err("O arquivo excede 32 MB.");
        }
        body.extend_from_slice(&chunk);
    }
}

unsafe extern "C" fn request_handler(request: Pointer, data: Pointer) {
    let (request, address, method, body, api) = unsafe {
        let address = CStr::from_ptr(webkit_uri_scheme_request_get_uri(request))
            .to_string_lossy()
            .into_owned();
        let method = CStr::from_ptr(webkit_uri_scheme_request_get_http_method(request))
            .to_string_lossy()
            .into_owned();
        let body = Option::<gio::InputStream>::from_glib_none(
            webkit_uri_scheme_request_get_http_body(request),
        );
        (
            glib::Object::from_glib_none(request.cast()),
            address,
            method,
            body,
            (&*data.cast::<Rc<Api>>()).clone(),
        )
    };
    let Some(route) = address.strip_prefix("makers3d://app") else {
        send(&request, 404, c"text/plain", b"Not found");
        return;
    };
    let route = route.split('#').next().unwrap_or_default();
    let (path, query) = route
        .split_once('?')
        .map_or((route, None), |(path, query)| {
            (path, Some(query.to_owned()))
        });
    match path {
        "/" => send(
            &request,
            200,
            c"text/html; charset=utf-8",
            include_bytes!("../web/dist/index.html"),
        ),
        "/app.js" => send(
            &request,
            200,
            c"text/javascript; charset=utf-8",
            include_bytes!("../web/dist/app.js"),
        ),
        "/app.css" => send(
            &request,
            200,
            c"text/css; charset=utf-8",
            include_bytes!("../web/dist/app.css"),
        ),
        path if path.starts_with("/api/") => {
            let path = path.to_owned();
            glib::spawn_future_local(async move {
                let (status, result) = match read_body(body).await {
                    Ok(body) => api.dispatch(&method, &path, query.as_deref(), &body),
                    Err(error) => (400, serde_json::json!({"error": error})),
                };
                send(
                    &request,
                    status,
                    c"application/json; charset=utf-8",
                    result.to_string().as_bytes(),
                );
            });
        }
        _ => send(&request, 404, c"text/plain", b"Not found"),
    }
}

unsafe extern "C" fn drop_api(data: Pointer) {
    drop(unsafe { Box::from_raw(data.cast::<Rc<Api>>()) });
}

pub fn view(api: Api) -> gtk::Widget {
    unsafe {
        let context = webkit_web_context_get_default();
        let security = webkit_web_context_get_security_manager(context);
        webkit_security_manager_register_uri_scheme_as_secure(security, c"makers3d".as_ptr());
        webkit_security_manager_register_uri_scheme_as_cors_enabled(security, c"makers3d".as_ptr());
        webkit_web_context_register_uri_scheme(
            context,
            c"makers3d".as_ptr(),
            request_handler,
            Box::into_raw(Box::new(Rc::new(api))).cast(),
            drop_api,
        );
        let widget = gtk::Widget::from_glib_none(webkit_web_view_new());
        let session =
            glib::Object::from_glib_none(webkit_web_view_get_network_session(raw(&widget)).cast());
        session.connect_local("download-started", false, |values| {
            let Ok(download) = values[1].get::<glib::Object>() else {
                return None;
            };
            download.connect_local("decide-destination", false, |values| {
                if let (Ok(download), Ok(filename)) =
                    (values[0].get::<glib::Object>(), values[1].get::<String>())
                {
                    choose_destination(download, &filename);
                }
                Some(true.to_value())
            });
            None
        });
        webkit_web_view_load_uri(raw(&widget), c"makers3d://app/".as_ptr());
        widget
    }
}

fn choose_destination(download: glib::Object, filename: &str) {
    let application = gio::Application::default().and_downcast::<gtk::Application>();
    let parent = application.and_then(|application| application.active_window());
    let dialog = gtk::FileChooserDialog::new(
        Some("Salvar arquivo"),
        parent.as_ref(),
        gtk::FileChooserAction::Save,
        &[
            ("Cancelar", gtk::ResponseType::Cancel),
            ("Salvar", gtk::ResponseType::Accept),
        ],
    );
    dialog.set_modal(true);
    dialog.set_current_name(filename);
    dialog.set_default_response(gtk::ResponseType::Accept);
    dialog.connect_response(move |dialog, response| {
        unsafe {
            if response == gtk::ResponseType::Accept
                && let Some(path) = dialog.file().and_then(|file| file.path())
            {
                webkit_download_set_allow_overwrite(raw(&download), 1);
                webkit_download_set_destination(raw(&download), path.to_glib_none().0);
            } else {
                webkit_download_cancel(raw(&download));
            }
        }
        dialog.close();
    });
    dialog.present();
}
