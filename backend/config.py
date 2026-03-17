import os
from dotenv import load_dotenv

load_dotenv()

FLASK_HOST = os.getenv(
    'FLASK_HOST',
    '0.0.0.0'
)
FLASK_PORT = os.getenv(
    'FLASK_PORT',
    5000
)

CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000'
).split(',')

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'videos.json')

# Fallback screen width and height if not provided by frontend
SCREEN_WIDTH = int(os.getenv("SCREEN_WIDTH", "1920"))
SCREEN_HEIGHT = int(os.getenv("SCREEN_HEIGHT", "1080"))

SMOOTHING_WINDOW = int(os.getenv("SMOOTHING_WINDOW", "5"))
FIXATION_THRESHOLD = int(os.getenv("FIXATION_THRESHOLD", "1000"))  # pixels/second - threshold for detecting fixations (~30 deg/s)

# Maximum acceptable calibration error in pixels
MAX_CALIBRATION_ERROR_PX = int(os.getenv("MAX_CALIBRATION_ERROR_PX", "200"))