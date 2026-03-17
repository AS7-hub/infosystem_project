import logging
from analytics.preprocessing import preprocess_gaze_data
from analytics.metrics import compute_all_metrics
from analytics.visualization import generate_plots, distraction_timeline
from models.analytics import AnalyticsResult


def analyze_gaze_session(
    gaze_data: list,
    viewport_width: int,
    viewport_height: int,
) -> AnalyticsResult:
    """
    Process gaze data through the analytics pipeline.

    Args:
        gaze_data: List of gaze point dictionaries.
        viewport_width: Viewport width in pixels (from frontend)
        viewport_height: Viewport height in pixels (from frontend)

    Returns:
        AnalyticsResult with metrics and plots.

    Raises:
        ValueError: If gaze_data is empty or invalid.
    """
    if not gaze_data:
        raise ValueError("No gaze data provided")

    screen_w = viewport_width if viewport_width is not None else SCREEN_WIDTH
    screen_h = viewport_height if viewport_height is not None else SCREEN_HEIGHT

    try:
        df = preprocess_gaze_data(gaze_data)
        metrics = compute_all_metrics(df)
        plots = generate_plots(df, screen_w=screen_w, screen_h=screen_h)
        
        # Add distraction timeline plot
        distraction_plot = distraction_timeline(df)
        if distraction_plot:
            plots['distraction_timeline'] = distraction_plot
        
        return AnalyticsResult(
            status="success",
            metrics=metrics,
            plots=plots
        )
    except Exception as e:
        logging.error(f"Analytics error: {e}")
        raise
