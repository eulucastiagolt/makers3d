mod agents;
mod api;
mod browser;
mod calc;
mod chat;
mod chat_actions;
mod chat_connection;
mod chat_history;
mod filament;
mod login;
mod printer;
mod store;

use gtk4::{self as gtk, gio, glib, prelude::*};

fn install_titlebar(window: &gtk::ApplicationWindow) {
    let display = gtk::prelude::WidgetExt::display(window);
    let css = gtk::CssProvider::new();
    css.load_from_data(include_str!("window.css"));
    gtk::style_context_add_provider_for_display(
        &display,
        &css,
        gtk::STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    let titlebar = gtk::HeaderBar::builder()
        .show_title_buttons(true)
        .decoration_layout(":minimize,maximize,close")
        .build();
    titlebar.add_css_class("makers-titlebar");
    titlebar.set_title_widget(Some(&gtk::Box::new(gtk::Orientation::Horizontal, 0)));

    let brand = gtk::Box::new(gtk::Orientation::Horizontal, 8);
    brand.add_css_class("makers-brand");
    brand.append(&gtk::Image::from_icon_name("printer-symbolic"));
    brand.append(&gtk::Label::new(Some("Makers 3D")));
    titlebar.pack_start(&brand);
    window.set_titlebar(Some(&titlebar));
}

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
            println!(
                "{} orçamento(s), {} impressora(s) e {} filamento(s) importados.",
                result["added"], result["printers"], result["filaments"]
            );
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
        install_titlebar(&window);
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
