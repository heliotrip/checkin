import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Slider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { ContentCopy, Share, Edit } from "@mui/icons-material";
import { Line } from "react-chartjs-2";

const categories = [
  {
    key: "overall",
    label: "Overall",
    icon: "🎯",
    color: "#1976d2",
    description: "Your overall satisfaction and energy about work right now"
  },
  {
    key: "wellbeing",
    label: "Wellbeing",
    icon: "🌱",
    color: "#388e3c",
    description: "Physical energy, mental clarity, and emotional balance"
  },
  {
    key: "growth",
    label: "Growth",
    icon: "📈",
    color: "#f57c00",
    description: "Learning new skills, developing capabilities, making progress"
  },
  {
    key: "relationships",
    label: "Relationships",
    icon: "👥",
    color: "#e91e63",
    description: "Connection with teammates, communication, and collaboration quality"
  },
  {
    key: "impact",
    label: "Impact",
    icon: "⚡",
    color: "#7b1fa2",
    description: "Meaningful work, moving the needle, creating real value"
  },
];

function CheckinPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [values, setValues] = useState({
    overall: 5,
    wellbeing: 5,
    growth: 5,
    relationships: 5,
    impact: 5,
  });
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [editNameDialog, setEditNameDialog] = useState(false);
  const [currentName, setCurrentName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [existingEntryForDate, setExistingEntryForDate] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const loadCurrentName = useCallback(() => {
    const storedNames = localStorage.getItem("checkin-id-names");
    if (storedNames) {
      try {
        const names = JSON.parse(storedNames);
        setCurrentName(names[userId] || "");
      } catch (e) {
        console.error("Error parsing ID names:", e);
      }
    }
  }, [userId]);

  const fetchHistoricalData = useCallback(async () => {
    try {
      const response = await fetch(`/api/checkins/${userId}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  }, [userId]);

  const fetchDataForDate = useCallback(async () => {
    try {
      const response = await fetch(`/api/checkins/${userId}/${date}`);
      const data = await response.json();

      if (data) {
        // Existing entry found
        setExistingEntryForDate(data);
        setValues({
          overall: data.overall,
          wellbeing: data.wellbeing,
          growth: data.growth,
          relationships: data.relationships,
          impact: data.impact,
        });
        setIsAddingMode(false);
      } else {
        // No entry for this date - show historical data but don't allow editing yet
        setExistingEntryForDate(null);

        // Get fresh historical data for displaying previous values
        const histResponse = await fetch(`/api/checkins/${userId}`);
        const histData = await histResponse.json();

        const previousEntry = histData
          .filter((entry) => entry.date < date)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        if (previousEntry) {
          setValues({
            overall: previousEntry.overall,
            wellbeing: previousEntry.wellbeing,
            growth: previousEntry.growth,
            relationships: previousEntry.relationships,
            impact: previousEntry.impact,
          });
        } else {
          setValues({
            overall: 5,
            wellbeing: 5,
            growth: 5,
            relationships: 5,
            impact: 5,
          });
        }
        setIsAddingMode(false);
      }
    } catch (error) {
      console.error("Error fetching data for date:", error);
    }
  }, [userId, date]);

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }
    fetchHistoricalData();
    fetchDataForDate();
    loadCurrentName();
  }, [userId, date, navigate, fetchHistoricalData, fetchDataForDate, loadCurrentName]);

  const handleSliderChange = (category, newValue) => {
    setValues((prev) => ({
      ...prev,
      [category]: newValue,
    }));
  };

  const handleStartAdding = () => {
    setIsAddingMode(true);
    setValues({
      overall: 5,
      wellbeing: 5,
      growth: 5,
      relationships: 5,
      impact: 5,
    });
  };

  const handleCancelAdding = () => {
    setIsAddingMode(false);
    // Reset to previous values
    if (existingEntryForDate) {
      setValues({
        overall: existingEntryForDate.overall,
        wellbeing: existingEntryForDate.wellbeing,
        growth: existingEntryForDate.growth,
        relationships: existingEntryForDate.relationships,
        impact: existingEntryForDate.impact,
      });
    } else {
      fetchDataForDate();
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          date,
          ...values,
        }),
      });

      if (response.ok) {
        await fetchHistoricalData();
        await fetchDataForDate(); // Refresh the current date data
        setIsAddingMode(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        // Try to get error details from response
        let errorMessage = `Failed to save check-in (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If can't parse error response, use generic message
        }
        setSaveError(errorMessage);
        setTimeout(() => setSaveError(""), 5000);
      }
    } catch (error) {
      // Network error or other fetch failure
      let errorMessage = "Unable to connect to server. Please check your internet connection and try again.";
      if (error.message) {
        errorMessage = `Save failed: ${error.message}`;
      }
      setSaveError(errorMessage);
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const shareUrl = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Checkin Progress",
          text: "View my check-in progress",
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      copyToClipboard();
    }
  };

  const openEditName = () => {
    setEditingName(currentName);
    setEditNameDialog(true);
  };

  const handleSaveName = () => {
    const storedNames = localStorage.getItem("checkin-id-names");
    let names = {};
    if (storedNames) {
      try {
        names = JSON.parse(storedNames);
      } catch (e) {
        console.error("Error parsing ID names:", e);
      }
    }

    if (editingName.trim()) {
      names[userId] = editingName.trim();
    } else {
      delete names[userId];
    }

    localStorage.setItem("checkin-id-names", JSON.stringify(names));
    setCurrentName(editingName.trim());
    setEditNameDialog(false);
    setEditingName("");
  };

  const getSparklineData = (category) => {
    const categoryData = historicalData.map((entry) => ({
      date: entry.date,
      value: entry[category],
    }));

    return {
      labels: categoryData.map((d) => d.date),
      datasets: [
        {
          data: categoryData.map((d) => d.value),
          borderColor:
            categories.find((c) => c.key === category)?.color || "#1976d2",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: 'rgba(255, 255, 255, 0.9)',
          pointBorderColor: categories.find((c) => c.key === category)?.color || "#1976d2",
          pointBorderWidth: 2,
          tension: 0.4,
        },
      ],
    };
  };

  const sparklineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 5,
        right: 5,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        mode: 'nearest',
        intersect: false,
        backgroundColor: 'rgba(0,0,0,0.9)',
        titleColor: 'white',
        bodyColor: 'white',
        cornerRadius: 4,
        displayColors: false,
        position: 'average',
        yAlign: 'top',
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            return `${context.parsed.y}/10`;
          }
        }
      },
    },
    scales: {
      x: {
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        display: false,
        min: 0.2,
        max: 11.5,
        grid: {
          display: false,
        },
      },
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'currentColor',
        borderWidth: 1,
      },
      line: {
        borderWidth: 2,
      },
    },
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 3,
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            sx={{
              color: "#1976d2",
              fontWeight: "bold",
              mr: 2,
            }}
          >
            Checkin
          </Typography>
          <Tooltip title={copySuccess ? "Copied!" : "Copy link"}>
            <IconButton onClick={copyToClipboard} color="primary">
              <ContentCopy />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share">
            <IconButton onClick={shareUrl} color="primary">
              <Share />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography
          variant="h6"
          gutterBottom
          sx={{
            textAlign: "center",
            color: "#666",
            mb: 2,
          }}
        >
          Track your 1-1 check-ins over time
        </Typography>

        {currentName && (
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              textAlign: "center",
              color: "#1976d2",
              fontWeight: "bold",
              mb: 2,
            }}
          >
            {currentName}
          </Typography>
        )}

        <Box sx={{ mb: 3 }}>
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
          {historicalData.length > 0 && (
            <Typography
              variant="caption"
              sx={{
                color: "#666",
                mt: 1,
                display: "block",
                textAlign: "center",
                fontSize: "0.8rem",
              }}
            >
              Last check-in: {historicalData[historicalData.length - 1]?.date || 'Never'}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
            },
            gap: 2,
            maxWidth: "100%",
          }}
        >
          {categories.map((category) => (
            <Paper
              key={category.key}
              elevation={1}
              onMouseEnter={() => setHoveredCategory(category.key)}
              onMouseLeave={() => setHoveredCategory(null)}
              sx={{
                p: 3,
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "1.5rem",
                  }}
                >
                  {category.icon}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: category.color,
                    fontWeight: "bold",
                  }}
                >
                  {category.label}
                </Typography>
              </Box>

              <Box
                sx={{
                  width: "100%",
                  height: 50,
                  mb: 3,
                  overflow: "visible",
                }}
              >
                {!isAddingMode && historicalData.length > 1 && (
                  <Line
                    data={getSparklineData(category.key)}
                    options={sparklineOptions}
                  />
                )}
              </Box>

              <Box sx={{ px: 1, flexGrow: 1 }}>
                {/* Slider with inline emoji indicators */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Typography sx={{ fontSize: "1.2rem", flexShrink: 0 }}>
                    😞
                  </Typography>

                  <Slider
                    value={values[category.key]}
                    onChange={(e, newValue) =>
                      handleSliderChange(category.key, newValue)
                    }
                    min={1}
                    max={10}
                    step={1}
                    marks
                    valueLabelDisplay="on"
                    disabled={!isAddingMode && !existingEntryForDate}
                    sx={{
                      color: category.color,
                      flex: 1,
                      "& .MuiSlider-thumb": {
                        height: 24,
                        width: 24,
                      },
                      "& .MuiSlider-track": {
                        height: 8,
                      },
                      "& .MuiSlider-rail": {
                        height: 8,
                      },
                    }}
                  />

                  <Typography sx={{ fontSize: "1.2rem", flexShrink: 0 }}>
                    😊
                  </Typography>
                </Box>

                {/* Category description below slider - always reserve space */}
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: "center",
                    color: hoveredCategory === category.key ? "#666" : "transparent",
                    mt: 2,
                    fontSize: "0.85rem",
                    fontStyle: "italic",
                    lineHeight: 1.3,
                    minHeight: "2.4em", // Reserve space for 2 lines
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {category.description}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          {!isAddingMode && !existingEntryForDate && (
            <Button
              variant="contained"
              size="large"
              onClick={handleStartAdding}
              sx={{
                px: 6,
                py: 1.5,
                fontSize: "1.1rem",
                fontWeight: "bold",
                borderRadius: 2,
                backgroundColor: "#2e7d32",
                "&:hover": {
                  backgroundColor: "#1b5e20",
                },
              }}
            >
              Add Check-in
            </Button>
          )}

          {isAddingMode && (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={handleCancelAdding}
                disabled={loading}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: "1.1rem",
                  borderRadius: 2,
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={handleSave}
                disabled={loading}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  borderRadius: 2,
                }}
              >
                {loading ? "Saving..." : "Save"}
              </Button>
            </Box>
          )}

          {existingEntryForDate && !isAddingMode && (
            <Button
              variant="contained"
              size="large"
              onClick={handleSave}
              disabled={loading}
              sx={{
                px: 6,
                py: 1.5,
                fontSize: "1.1rem",
                fontWeight: "bold",
                borderRadius: 2,
              }}
            >
              {loading ? "Updating..." : "Update Check-in"}
            </Button>
          )}
        </Box>

        {saveSuccess && (
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography
              variant="body1"
              sx={{
                color: "#2e7d32",
                fontWeight: "bold",
                backgroundColor: "#e8f5e8",
                padding: "8px 16px",
                borderRadius: 1,
                display: "inline-block",
              }}
            >
              ✅ Check-in saved successfully!
            </Typography>
          </Box>
        )}

        {saveError && (
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography
              variant="body1"
              sx={{
                color: "#d32f2f",
                fontWeight: "bold",
                backgroundColor: "#ffeaea",
                padding: "8px 16px",
                borderRadius: 1,
                display: "inline-block",
                border: "1px solid #ffcdd2",
              }}
            >
              ❌ {saveError}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            mt: 2,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: "#999" }}>
            ID: {userId}
          </Typography>
          <IconButton size="small" onClick={openEditName}>
            <Edit fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Button
            variant="outlined"
            onClick={() => navigate("/")}
            sx={{ mr: 2 }}
          >
            ← Back to Home
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate(`/${userId}/data`)}
          >
            Edit Data
          </Button>
        </Box>
      </Paper>

      <Dialog
        open={editNameDialog}
        onClose={() => setEditNameDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Name for ID</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#666", mb: 2 }}>
            ID: {userId.substring(0, 8)}...
          </Typography>
          <TextField
            autoFocus
            label="Name (optional)"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            fullWidth
            variant="outlined"
            placeholder="Enter a name to identify this team member"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSaveName();
              }
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: "#999", mt: 1, display: "block" }}
          >
            Names are stored locally on your device for convenience. Leave empty
            to remove the name.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditNameDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveName} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CheckinPage;
