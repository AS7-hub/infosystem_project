import pandas as pd


def distraction_metrics(df, session_duration_sec=None):
    """
    Detect and measure distraction periods when gaze goes off-screen.
    
    A distraction is defined as a continuous period where the gaze is off-screen.
    
    Args:
        df: DataFrame with gaze data
        session_duration_sec: Total session duration in seconds (optional, calculated if not provided)
    
    Returns:
        dict: Distraction metrics including:
            - num_distractions: count of distinct distraction periods
            - total_distraction_duration (sec): total time spent distracted
            - avg_distraction_duration (sec): average duration per distraction
            - distraction_ratio: percentage of session time spent distracted
    """
    if df.empty or "on_screen" not in df.columns:
        return {
            "num_distractions": 0,
            "total_distraction_duration (sec)": 0.0,
            "avg_distraction_duration (sec)": 0.0,
            "distraction_ratio": 0.0,
        }
    
    # Detect transitions: on_screen changing from True to False
    df["screen_change"] = df["on_screen"].astype(int).diff()
    
    # Start of distraction: on_screen goes from 1 to 0 (screen_change = -1)
    distraction_starts = df[df["screen_change"] == -1].index.tolist()
    
    # End of distraction: on_screen goes from 0 to 1 (screen_change = 1)
    distraction_ends = df[df["screen_change"] == 1].index.tolist()
    
    # Handle edge cases
    # If starts off-screen, add first index as start
    if not df["on_screen"].iloc[0] and (not distraction_starts or distraction_starts[0] != 0):
        distraction_starts.insert(0, 0)
    
    # If ends off-screen, add last index as end
    if not df["on_screen"].iloc[-1]:
        distraction_ends.append(len(df) - 1)
    
    # Match starts and ends
    num_distractions = min(len(distraction_starts), len(distraction_ends))
    
    if num_distractions == 0:
        return {
            "num_distractions": 0,
            "total_distraction_duration (sec)": 0.0,
            "avg_distraction_duration (sec)": 0.0,
        }
    
    # Calculate durations for each distraction period
    distraction_durations = []
    for i in range(num_distractions):
        start_idx = distraction_starts[i]
        end_idx = distraction_ends[i]
        
        start_time = df.iloc[start_idx]["timestamp"]
        end_time = df.iloc[end_idx]["timestamp"]
        
        duration_ms = end_time - start_time
        duration_sec = duration_ms / 1000.0
        
        # Filter out blinks: only count distractions longer than 200ms
        # Typical blinks are 100-150ms, so 200ms threshold avoids counting them
        if duration_sec >= 1.0:
            distraction_durations.append(duration_sec)
    
    # Recalculate based on filtered distractions
    num_distractions = len(distraction_durations)
    
    if num_distractions == 0:
        return {
            "num_distractions": 0,
            "total_distraction_duration (sec)": 0.0,
            "avg_distraction_duration (sec)": 0.0,
            "distraction_ratio": 0.0,
        }
    
    total_duration = sum(distraction_durations)
    avg_duration = total_duration / num_distractions if num_distractions > 0 else 0.0
    
    # Calculate session duration if not provided
    if session_duration_sec is None:
        first_ts = df["timestamp"].min()
        last_ts = df["timestamp"].max()
        session_duration_sec = (last_ts - first_ts) / 1000.0
    
    # Calculate distraction ratio (percentage of time distracted)
    distraction_ratio = (total_duration / session_duration_sec) * 100 if session_duration_sec > 0 else 0.0
    
    return {
        "num_distractions": num_distractions,
        "total_distraction_duration (sec)": round(total_duration, 2),
        "avg_distraction_duration (sec)": round(avg_duration, 2),
        "distraction_ratio": round(distraction_ratio, 2),
    }
