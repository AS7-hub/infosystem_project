import math
from flask import Blueprint, jsonify, request

from config import MAX_CALIBRATION_ERROR_PX

calibration_bp = Blueprint("calibration", __name__, url_prefix="/api")


@calibration_bp.route("/calibration/accuracy", methods=["POST"])
def calibration_accuracy():
    """
    Accept gaze samples collected while user focused on a center point.
    Discard the first 1 second, then compute mean pixel error vs target.
    Return mean error, normalized error (vs MAX_CALIBRATION_ERROR_PX), and accuracy_percent.
    """
    try:
        payload = request.json or {}
        gaze_samples = payload.get("gaze_samples", [])
        target_x = payload.get("target_x")
        target_y = payload.get("target_y")

        if not gaze_samples:
            return jsonify({"error": "No gaze samples provided"}), 400

        if target_x is None or target_y is None:
            return jsonify({"error": "target_x and target_y are required"}), 400

        try:
            target_x = float(target_x)
            target_y = float(target_y)
        except (TypeError, ValueError):
            return jsonify({"error": "target_x and target_y must be numbers"}), 400

        start_ts = gaze_samples[0].get("timestamp")
        if start_ts is None:
            return jsonify({"error": "Gaze samples must include timestamp"}), 400

        # one_second_ms = 1000
        # used = [
        #     p
        #     for p in gaze_samples
        #     if p.get("timestamp") is not None
        #     and (p["timestamp"] - start_ts) >= one_second_ms
        # ]
        used = gaze_samples

        if not used:
            return jsonify({"error": "No gaze samples after discarding first second"}), 400

        errors = []
        for p in used:
            x = p.get("x")
            y = p.get("y")
            if x is None or y is None:
                continue
            try:
                x, y = float(x), float(y)
            except (TypeError, ValueError):
                continue
            err = math.sqrt((x - target_x) ** 2 + (y - target_y) ** 2)
            errors.append(err)

        if not errors:
            return jsonify({"error": "No valid gaze points (x, y) in samples"}), 400

        mean_error_px = sum(errors) / len(errors)
        normalized_error = mean_error_px / MAX_CALIBRATION_ERROR_PX
        accuracy_percent = max(0.0, 100.0 * (1.0 - min(1.0, normalized_error)))

        return jsonify({
            "accuracy_percent": round(accuracy_percent, 2),
        })
    except Exception as e:
        return jsonify({"error": "Internal Server Error"}), 500