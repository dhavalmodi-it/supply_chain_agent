def generate_dashboard_response(results, forecasts):
    """
    Formats final API response for frontend dashboard
    """

    try:
        return {
            "objective": "Increase agility, resilience, and efficiency across supply chain using AI-driven forecasting and intelligent decision-making",
            "products": results,
            "forecasts": {
                k: v.tolist() if hasattr(v, "tolist") else v
                for k, v in forecasts.items()
            }
        }
    except Exception as e:
        return {
            "error": f"Report generation failed: {str(e)}"
        }