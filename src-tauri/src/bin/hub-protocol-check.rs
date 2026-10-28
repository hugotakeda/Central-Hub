//! JSON-lines diagnostic transport. Only started explicitly by a hardware test.
#[cfg(all(windows, feature = "hardware-hid"))]
fn main() {
    use central_hub_lib::protocol_hid::{native, Request};
    use std::{
        io::{BufRead, Write},
        sync::{Arc, Mutex},
    };
    let out = Arc::new(Mutex::new(std::io::stdout()));
    fn print(out: &Arc<Mutex<std::io::Stdout>>, value: serde_json::Value) -> bool {
        let Ok(mut stdout) = out.lock() else {
            return false;
        };
        writeln!(stdout, "{value}")
            .and_then(|_| stdout.flush())
            .is_ok()
    }
    for line in std::io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };
        let id = v["id"].clone();
        let interface = v["interface"].as_str().unwrap_or_default().to_string();
        let result: Result<serde_json::Value, String> = (|| match v["operation"]
            .as_str()
            .unwrap_or_default()
        {
            "inventory" => native::inventory(
                serde_json::from_value(v["vendors"].clone()).map_err(|e| e.to_string())?,
            )
            .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
            "open" => {
                let event_out = out.clone();
                let event_id = interface.clone();
                native::open(
                    interface,
                    Arc::new(move |report| {
                        print(
                            &event_out,
                            serde_json::json!({"event":"inputreport","interface":event_id,"report":report}),
                        )
                    }),
                )?;
                Ok(serde_json::Value::Null)
            }
            "exchange" => native::exchange(
                interface,
                serde_json::from_value::<Request>(v["request"].clone())
                    .map_err(|e| e.to_string())?,
            )
            .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string())),
            "close" => {
                native::close(interface)?;
                Ok(serde_json::Value::Null)
            }
            _ => Err("Operação desconhecida.".into()),
        })();
        match result {
            Ok(result) => {
                print(&out, serde_json::json!({"id":id,"result":result}));
            }
            Err(error) => {
                print(&out, serde_json::json!({"id":id,"error":error}));
            }
        }
    }
    native::close_all();
}
#[cfg(not(all(windows, feature = "hardware-hid")))]
fn main() {
    eprintln!("Disponível somente em Windows com hardware-hid.");
    std::process::exit(1);
}
