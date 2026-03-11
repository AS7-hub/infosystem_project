from analytics.metrics.temporal import temporal_metrics
from analytics.metrics.spatial import spatial_metrics
from analytics.metrics.attention import attention_metrics
from analytics.metrics.distraction import distraction_metrics
from analytics.metrics.heatmap import aoi_grid




def compute_all_metrics(df):
    # Calculate individual metrics
    temporal = temporal_metrics(df)
    spatial = spatial_metrics(df)
    attention = attention_metrics(df)
    
    # Get session duration for distraction calculation
    session_duration_sec = temporal.get("session_duration (sec)", 0)
    distraction = distraction_metrics(df, session_duration_sec)
    
    # Calculate focus score using new formula:
    # focus_score = 0.4 × on_screen_ratio + 0.3 × fixation_ratio + 0.3 × (100 - distraction_ratio)
    on_screen_ratio = attention.get("on_screen_ratio", 0)
    fixation_ratio = attention.get("fixation_ratio", 0)
    distraction_ratio = distraction.get("distraction_ratio", 0)
    
    focus_score = (
        0.4 * on_screen_ratio * 100 +
        0.3 * fixation_ratio * 100 +
        0.3 * (100 - distraction_ratio)
    )
    
    # Add focus score to attention metrics
    attention["focus_score"] = round(focus_score, 2)
    
    return {
        "temporal": temporal,
        "spatial": spatial,
        "attention": attention,
        "distraction": distraction
    }


__all__ = ['temporal_metrics', 'spatial_metrics', 'attention_metrics', 'distraction_metrics', 'aoi_grid', 'compute_all_metrics']