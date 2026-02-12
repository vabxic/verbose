from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)
root = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

cert_path = os.path.join(BASE_DIR, "certificates", "cert.pem")
key_path = os.path.join(BASE_DIR, "certificates", "key.pem")


@app.route("/")
def landing_page():
    return render_template("landing_page.html")

@app.route("/auth.js")
def serve_auth():
    return send_from_directory(os.path.join(root, "templates"), "auth.js")
@app.route("/home")
def home_page():
    return render_template("home.html")
if __name__ == "__main__":
    app.run(debug=True, 
            host='0.0.0.0',
            port=5000,
           ssl_context=(cert_path, key_path))
