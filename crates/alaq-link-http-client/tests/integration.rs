use alaq_link_http_client::HttpClient;
use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tokio::net::TcpListener;

#[derive(Serialize, Deserialize)]
struct Input { name: String }
#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct Output { id: String }

async fn handle_action(Json(payload): Json<serde_json::Value>) -> Json<Output> {
    let name = payload["input"]["name"].as_str().unwrap();
    Json(Output { id: format!("hi_{}", name) })
}

#[tokio::test]
async fn test_client_success() {
    let app = Router::new().route("/test_action", post(handle_action));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let client = HttpClient::new(format!("http://{}", addr));
    let res: Output = client.call_action("test_action", Input { name: "rust".into() }).await.unwrap();
    
    assert_eq!(res, Output { id: "hi_rust".into() });
}
