mod api;
mod browser;
mod calc;
mod store;

use gtk4::{self as gtk, gio, glib, prelude::*};

fn main() -> glib::ExitCode {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if let [command, file] = args.as_slice()
        && command == "--import-backup"
    {
        return match api::Api::open().and_then(|api| {
            let body = std::fs::read(file)?;
            let (status, result) = api.dispatch("POST", "/api/backup", None, &body);
            if status != 200 {
                return Err(result["error"]
                    .as_str()
                    .unwrap_or("Falha na importação.")
                    .to_owned()
                    .into());
            }
            println!("{} orçamento(s) importado(s).", result["added"]);
            Ok(())
        }) {
            Ok(()) => glib::ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("{error}");
                glib::ExitCode::FAILURE
            }
        };
    }
    let app = gtk::Application::new(
        Some("io.github.eulucastiagolt.Makers3D"),
        gio::ApplicationFlags::empty(),
    );
    app.connect_activate(|app| {
        if let Some(window) = app.active_window() {
            window.present();
            return;
        }
        let window = gtk::ApplicationWindow::builder()
            .application(app)
            .title("Makers 3D")
            .default_width(1300)
            .default_height(850)
            .build();
        match api::Api::open() {
            Ok(api) => window.set_child(Some(&browser::view(api))),
            Err(error) => {
                let message = gtk::Label::new(Some(&format!(
                    "Não foi possível abrir os dados locais.\n{error}"
                )));
                message.set_wrap(true);
                window.set_child(Some(&message));
            }
        }
        window.present();
    });
    app.run()
}
