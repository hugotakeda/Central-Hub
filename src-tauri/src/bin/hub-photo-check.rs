//! Read-only internet photo resolver check. Does not enumerate or alter hardware.
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 5 {
        eprintln!("Uso: hub-photo-check CACHE_DIR MARCA MODELO TIPO [--force]");
        std::process::exit(2);
    }
    let service = central_hub_lib::photos::PhotoService::new(std::path::PathBuf::from(&args[1]));
    let query = central_hub_lib::photos::PhotoQuery {
        manufacturer: args[2].clone(),
        name: args[3].clone(),
        kind: args[4].clone(),
    };
    match service.resolve(query, args.iter().any(|s| s == "--force")) {
        Ok(photo) => {
            let mut json = serde_json::to_value(photo).unwrap();
            if let Some(map) = json.as_object_mut() {
                map.remove("data_url");
            }
            println!("{}", serde_json::to_string_pretty(&json).unwrap());
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
