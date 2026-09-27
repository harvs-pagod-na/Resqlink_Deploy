import os
import sys
import traceback

# Add current directory to sys.path to guarantee clean blueprint imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask  # type: ignore # pyrefly: ignore [missing-import]
from dotenv import load_dotenv  # type: ignore # pyrefly: ignore [missing-import]

load_dotenv()

app = Flask(__name__)

# ─── Register Blueprints ───────────────────────────────────────
from routes.face import face_bp  # type: ignore # pyrefly: ignore [missing-import]
from routes.ocr import ocr_bp  # type: ignore # pyrefly: ignore [missing-import]
from routes.verify import verify_bp  # type: ignore # pyrefly: ignore [missing-import]
from routes.onboarding_verify import onboarding_verify_bp  # type: ignore # pyrefly: ignore [missing-import]
from routes.verify_documents import verify_docs_bp  # type: ignore # pyrefly: ignore [missing-import]
from routes.identity_cross_match import identity_cross_match_bp  # type: ignore # pyrefly: ignore [missing-import]

app.register_blueprint(face_bp, url_prefix='/ai')
app.register_blueprint(ocr_bp, url_prefix='/ai')
app.register_blueprint(verify_bp, url_prefix='/ai')
app.register_blueprint(onboarding_verify_bp, url_prefix='/ai')
app.register_blueprint(verify_docs_bp, url_prefix='/api')
app.register_blueprint(identity_cross_match_bp)


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'RESQLINK AI Verification Service', 'version': '1.0.0'}


@app.errorhandler(Exception)
def handle_error(e):
    traceback.print_exc()
    return {'success': False, 'error': str(e)}, 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    print(f'[AI] RESQLINK AI Verification Service running on port {port}')
    app.run(host='0.0.0.0', port=port, debug=debug)
