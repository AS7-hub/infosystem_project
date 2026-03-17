import logging
from flask import Blueprint, jsonify, request
from config import SCREEN_WIDTH, SCREEN_HEIGHT
from services import analyze_gaze_session

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api')

# Reasonable max viewport size for validation
MAX_VIEWPORT_DIM = 7680


def _parse_viewport(payload):
    """Extract and validate viewport dimensions; return (width, height) or use defaults."""
    w = payload.get("viewport_width")
    h = payload.get("viewport_height")
    if w is None and h is None:
        logging.warning("No viewport dimensions provided, using default values")
        return SCREEN_WIDTH, SCREEN_HEIGHT
    try:
        width = int(w)
        height = int(h)
    except (TypeError, ValueError):
        logging.warning("Invalid viewport dimensions provided, using default values")
        return SCREEN_WIDTH, SCREEN_HEIGHT
    if width <= 0 or height <= 0 or width > MAX_VIEWPORT_DIM or height > MAX_VIEWPORT_DIM:
        logging.warning("Viewport value outside of valid range, using default values")
        return SCREEN_WIDTH, SCREEN_HEIGHT
    return width, height

@analytics_bp.route("/analyze", methods=["POST"])
def analyze():
    try:
        payload = request.json or {}
        gaze_data = payload.get("gaze_data", [])

        if not gaze_data:
            return jsonify({"error": "No gaze data provided"}), 400

        viewport_width, viewport_height = _parse_viewport(payload)
        result = analyze_gaze_session(gaze_data, viewport_width=viewport_width, viewport_height=viewport_height)
        return jsonify(result.to_dict())

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Internal Server Error"}), 500
