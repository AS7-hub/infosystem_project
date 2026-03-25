import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pandas as pd
from utils.encoding import fig_to_base64
from config import SCREEN_WIDTH, SCREEN_HEIGHT
from analytics.metrics.heatmap import aoi_grid


def generate_plots(df, screen_w=None, screen_h=None):
    if screen_w is None:
        screen_w = SCREEN_WIDTH
    if screen_h is None:
        screen_h = SCREEN_HEIGHT
        
    if df.empty:
        return {}

    plots = {}
    
    # Filter for cleaner plots (only on-screen data)
    df_clean = df[df['on_screen'] == True].copy()

    # --- Clamping for Heatmaps ---
    # The user requested all gaze points (including out-of-bounds/distractions) to be included in heatmaps
    # by clamping them to the screen boundaries, strictly within visualization so metrics are unaffected.
    df_heatmap_clamped = df.copy()
    df_heatmap_clamped['x'] = df_heatmap_clamped['x'].clip(0, screen_w)
    df_heatmap_clamped['y'] = df_heatmap_clamped['y'].clip(0, screen_h)
    df_heatmap_clamped['x_smooth'] = df_heatmap_clamped['x_smooth'].clip(0, screen_w)
    df_heatmap_clamped['y_smooth'] = df_heatmap_clamped['y_smooth'].clip(0, screen_h)

    # Filter for Heatmap: Only keep coordinates where user looked for >= 0.25 seconds
    # We bin the screen into a 50x50 grid, sum the time spent ('dt') in each bin,
    # and only keep data points from bins with >= 0.25s total duration.
    bins_x = np.linspace(0, screen_w, 51)
    bins_y = np.linspace(0, screen_h, 51)
    df_heatmap_clamped['bin_x'] = np.digitize(df_heatmap_clamped['x_smooth'], bins_x)
    df_heatmap_clamped['bin_y'] = np.digitize(df_heatmap_clamped['y_smooth'], bins_y)
    
    bin_durations = df_heatmap_clamped.groupby(['bin_x', 'bin_y'])['dt'].sum().reset_index()
    valid_bins = bin_durations[bin_durations['dt'] >= 0.25]
    
    df_heatmap = pd.merge(df_heatmap_clamped, valid_bins[['bin_x', 'bin_y']], on=['bin_x', 'bin_y'])

    # --- Plot 1: 2D Heatmap (KDE) ---
    fig1, ax1 = plt.subplots(figsize=(10, 6))
    if not df_heatmap.empty and len(df_heatmap) > 1:
        try:
            sns.kdeplot(
                data=df_heatmap,
                x='x_smooth',
                y='y_smooth',
                fill=True,
                cmap='rocket',
                levels=30,
                alpha=0.85,
                ax=ax1,
                cbar=True,
                cbar_kws={'label': 'Gaze Density'}
            )
        except Exception as e:
            sns.scatterplot(
                data=df_heatmap,
                x='x_smooth',
                y='y_smooth',
                color='red',
                s=100,
                alpha=0.5,
                ax=ax1
            )
            print(f"KDE plot failed, drew scatter plot fallback. Error: {e}")
    ax1.set_xlim(0, screen_w)
    ax1.set_ylim(screen_h, 0)  # Invert Y for screen coordinates
    ax1.set_title("Gaze Intensity Heatmap")
    ax1.set_xlabel("Screen X")
    ax1.set_ylabel("Screen Y")
    plots['heatmap'] = fig_to_base64(fig1)

    # --- Plot 2: Scatter Plot (Time Colored) ---
    if not df_clean.empty:
        fig2, ax2 = plt.subplots(figsize=(10, 6))
        
        # Plot path lines first (underneath points)
        ax2.plot(df_clean['x_smooth'], df_clean['y_smooth'], 
                 color='lightgray', alpha=0.4, linewidth=1.5, zorder=1)
        
        # Scatter plot with seaborn for better styling
        scatter = sns.scatterplot(
            data=df_clean,
            x='x_smooth',
            y='y_smooth',
            hue='time_sec',
            palette='mako',
            alpha=0.75,
            s=25,
            edgecolor='white',
            linewidth=0.4,
            ax=ax2,
            legend=False,
            zorder=2
        )
        
        # Add colorbar
        norm = plt.Normalize(vmin=df_clean['time_sec'].min(), vmax=df_clean['time_sec'].max())
        sm = plt.cm.ScalarMappable(cmap='mako', norm=norm)
        sm.set_array([])
        plt.colorbar(sm, ax=ax2, label='Time (seconds)')
        
        ax2.set_xlim(0, screen_w)
        ax2.set_ylim(screen_h, 0)
        ax2.set_title("Gaze Path Over Time")
        ax2.set_xlabel("Screen X")
        ax2.set_ylabel("Screen Y")
        plots['scatter_path'] = fig_to_base64(fig2)

    # --- Plot 3: X-Coordinate Time Series ---
    fig3, ax3 = plt.subplots(figsize=(10, 4))
    
    # Add horizontal zone bands for context (left/center/right screen)
    ax3.axhspan(0, screen_w*0.33, alpha=0.08, color='blue', zorder=1)
    ax3.axhspan(screen_w*0.33, screen_w*0.67, alpha=0.08, color='green', zorder=1)
    ax3.axhspan(screen_w*0.67, screen_w, alpha=0.08, color='red', zorder=1)
    
    # Plot line with seaborn for better styling
    sns.lineplot(data=df, x='time_sec', y='x_smooth', 
                color='#1B4965', linewidth=2, ax=ax3, zorder=3)
    
    # Add gradient fill under the line
    ax3.fill_between(df['time_sec'], 0, df['x_smooth'], 
                     alpha=0.25, color='steelblue', zorder=2)
    
    # Softer boundary lines
    ax3.axhline(0, color='gray', linestyle=':', alpha=0.6, linewidth=1.5, zorder=4)
    ax3.axhline(screen_w, color='gray', linestyle=':', alpha=0.6, linewidth=1.5, zorder=4)
    
    ax3.set_title("Horizontal Eye Movement (Reading Pattern)", fontsize=11, pad=10)
    ax3.set_xlabel("Time (s)")
    ax3.set_ylabel("X Pixel")
    ax3.set_ylim(-50, screen_w + 50)  # Add padding for better visibility
    ax3.grid(True, alpha=0.2, linestyle='--', linewidth=0.5)
    plots['x_time_series'] = fig_to_base64(fig3)

    # --- Plot 4: Y-Coordinate Time Series ---
    fig4, ax4 = plt.subplots(figsize=(10, 4))
    
    # Add horizontal zone bands for context (top/middle/bottom screen)
    ax4.axhspan(0, screen_h*0.33, alpha=0.08, color='blue', zorder=1)
    ax4.axhspan(screen_h*0.33, screen_h*0.67, alpha=0.08, color='green', zorder=1)
    ax4.axhspan(screen_h*0.67, screen_h, alpha=0.08, color='red', zorder=1)
    
    # Plot line with seaborn for better styling
    sns.lineplot(data=df, x='time_sec', y='y_smooth', 
                color='#62374E', linewidth=2, ax=ax4, zorder=3)
    
    # Add gradient fill under the line
    ax4.fill_between(df['time_sec'], 0, df['y_smooth'], 
                     alpha=0.25, color='orchid', zorder=2)
    
    # Softer boundary lines
    ax4.axhline(0, color='gray', linestyle=':', alpha=0.6, linewidth=1.5, zorder=4)
    ax4.axhline(screen_h, color='gray', linestyle=':', alpha=0.6, linewidth=1.5, zorder=4)
    
    ax4.set_title("Vertical Eye Movement (Scrolling Pattern)", fontsize=11, pad=10)
    ax4.set_xlabel("Time (s)")
    ax4.set_ylabel("Y Pixel")
    ax4.set_ylim(-50, screen_h + 50)  # Add padding for better visibility
    ax4.grid(True, alpha=0.2, linestyle='--', linewidth=0.5)
    plots['y_time_series'] = fig_to_base64(fig4)

    # --- Plot 5: AOI Grid Heatmap ---
    fig5, ax5 = plt.subplots(figsize=(8, 8))
    
    # Compute AOI grid data using the dataframe with clamped boundary edges
    aoi_data = np.array(aoi_grid(df_heatmap_clamped))
    
    # Create heatmap
    sns.heatmap(
        aoi_data,
        annot=True,              # Show percentages in cells
        fmt='.1f',               # Format as float with 1 decimal
        cmap='YlOrRd',           # Yellow-Orange-Red gradient
        cbar_kws={'label': 'Attention %'},
        square=True,             # Square cells
        linewidths=1,            # Grid lines
        linecolor='white',       # White grid lines
        ax=ax5,
        vmin=0,                  # Minimum value for color scale
        vmax=aoi_data.max()      # Maximum value for color scale
    )
    
    ax5.set_title("Area of Interest Heatmap (5×5 Grid)", fontsize=12, pad=15)
    ax5.set_xlabel("Horizontal Zone (Left → Right)", fontsize=10)
    ax5.set_ylabel("Vertical Zone (Top → Bottom)", fontsize=10)
    ax5.set_xticklabels(['1', '2', '3', '4', '5'])
    ax5.set_yticklabels(['1', '2', '3', '4', '5'])
    plots['aoi_heatmap'] = fig_to_base64(fig5)

    return plots


def distraction_timeline(df):
    """
    Create a professional timeline visualization showing on-screen vs off-screen status over time.
    Uses seaborn styling for a sleek, modern appearance.
    
    Args:
        df: DataFrame with 'time_sec' and 'on_screen' columns
    
    Returns:
        Base64 encoded plot
    """
    if df.empty or 'on_screen' not in df.columns:
        return None
    
    # Set seaborn style for professional appearance
    sns.set_style("whitegrid", {
        'grid.linestyle': ':',
        'grid.alpha': 0.3,
        'axes.edgecolor': '#CCCCCC'
    })
    
    fig, ax = plt.subplots(figsize=(14, 4.5), facecolor='white')
    
    # Convert boolean to int for plotting
    on_screen_values = df['on_screen'].astype(int)
    time_vals = df['time_sec']
    
    # Create smooth gradient effect using multiple overlapping fills
    # Focused periods (professional forest green)
    for alpha_val in [0.15, 0.25, 0.35]:
        ax.fill_between(time_vals, 0, on_screen_values,
                         where=(on_screen_values == 1),
                         alpha=alpha_val, color='#059669',
                         step='post', linewidth=0, zorder=2)
    
    # Distracted periods (red/orange gradient)
    for alpha_val in [0.15, 0.25, 0.35]:
        ax.fill_between(time_vals, 0, 1,
                         where=(on_screen_values == 0),
                         alpha=alpha_val, color='#F59E0B',
                         step='post', linewidth=0, zorder=2)
    
    # Add sleek transition line
    ax.step(time_vals, on_screen_values,
            where='post', linewidth=2.5, color='#374151',
            alpha=0.85, zorder=4, solid_capstyle='round')
    
    # Add subtle markers at transition points
    transitions = on_screen_values.diff().fillna(0) != 0
    if transitions.any():
        transition_times = time_vals[transitions]
        transition_vals = on_screen_values[transitions]
        ax.scatter(transition_times, transition_vals,
                   s=45, color='#374151', alpha=0.7, zorder=5,
                   edgecolors='white', linewidths=1.5)
    
    # Modern styling
    ax.set_ylim(-0.08, 1.08)
    ax.set_xlim(time_vals.min() - 0.5, time_vals.max() + 0.5)
    
    # Clean axes
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#CCCCCC')
    ax.spines['bottom'].set_color('#CCCCCC')
    
    # Labels with modern typography
    ax.set_xlabel('Time (seconds)', fontsize=12, fontweight=500, color='#374151', labelpad=10)
    ax.set_ylabel('Attention State', fontsize=12, fontweight=500, color='#374151', labelpad=10)
    
    # Y-axis styling
    ax.set_yticks([0, 1])
    ax.set_yticklabels(['Distracted', 'Focused'], fontsize=11, color='#6B7280')
    
    # X-axis styling
    ax.tick_params(axis='x', labelsize=10, colors='#6B7280', length=5, width=1.2)
    ax.tick_params(axis='y', labelsize=11, colors='#6B7280', length=0)
    
    # Title with modern styling
    ax.set_title('Attention State Timeline',
                 fontsize=15, fontweight=600, color='#1F2937', pad=20, loc='left')
    
    # Add professional legend
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#059669', alpha=0.5, label='Focused'),
        Patch(facecolor='#F59E0B', alpha=0.5, label='Distracted')
    ]
    ax.legend(handles=legend_elements, loc='upper right',
              frameon=True, framealpha=0.95, edgecolor='#E5E7EB',
              fontsize=11, bbox_to_anchor=(0.98, 0.98))
    
    # Subtle grid
    ax.grid(True, axis='x', alpha=0.2, linestyle='--', linewidth=0.8, color='#D1D5DB')
    ax.set_axisbelow(True)
    
    # Clean background
    ax.set_facecolor('#FAFBFC')
    fig.patch.set_facecolor('white')
    
    plt.tight_layout()
    
    # Reset seaborn style to avoid affecting other plots
    sns.reset_defaults()
    
    return fig_to_base64(fig)