fn main() {
    let args: Vec<_> = std::env::args().collect();
    let result = if args.get(1).map(String::as_str) == Some("--test") {
        args.get(2)
            .ok_or_else(|| "Informe a identidade física.".to_string())
            .and_then(|id| central_hub_lib::hardware_test::execute(id, &[]))
            .and_then(|r| serde_json::to_string_pretty(&r).map_err(|e| e.to_string()))
    } else {
        central_hub_lib::diagnostics_json()
    };
    match result {
        Ok(json) => println!("{json}"),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
