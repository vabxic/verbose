from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)
root = os.path.dirname(os.path.abspath(__file__))

@app.route("/")
def hello_world():
    return render_template("landing_page.html")

@app.route("/auth.js")
def serve_auth():
    return send_from_directory(root, "auth.js")

if __name__ == "__main__":
    app.run(debug=True)
