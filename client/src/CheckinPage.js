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

// Emoji scale for slider values (1-10)
const emojiScale = {
  1: "😫", // Exhausted
  2: "😢", // Crying
  3: "😞", // Disappointed
  4: "😕", // Slightly Frowning
  5: "😐", // Neutral
  6: "🙂", // Slightly Smiling
  7: "😊", // Smiling
  8: "😄", // Happy
  9: "😁", // Grinning
  10: "🤩" // Star-Struck/Fabulous
};

// Custom slider styles with emoji overlay using CSS
const getEmojiSliderStyles = (categoryKey, values, categoryColor, isLoading = false, hasExistingEntry = true, hasUserMadeChanges = false) => {
  // Show loading state styling
  if (isLoading) {
    return {
      color: '#bbb',
      flex: 1,
      "& .MuiSlider-track": {
        height: 8,
        backgroundColor: '#ddd',
      },
      "& .MuiSlider-rail": {
        height: 8,
        backgroundColor: '#f0f0f0',
      },
      "& .MuiSlider-thumb": {
        height: 28,
        width: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        border: '2px solid #bbb',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        position: 'relative',
        '&:before': {
          boxShadow: 'none',
        },
        '&:after': {
          content: 'attr(data-emoji)',
          position: 'absolute',
          fontSize: '16px',
          fontWeight: 'normal',
          pointerEvents: 'none',
          userSelect: 'none',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          lineHeight: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
        },
        '&:hover': {
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        },
        '&.Mui-focusVisible': {
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        },
      }
    };
  }

  // Show monochrome styling for no existing entry (but keep it looking active)
  const shouldShowMonochrome = !hasExistingEntry && !hasUserMadeChanges;
  const finalColor = shouldShowMonochrome ? '#666' : categoryColor;

  return {
    color: finalColor,
    flex: 1,
    "& .MuiSlider-track": {
      height: 8,
      backgroundColor: 'currentColor',
    },
    "& .MuiSlider-rail": {
      height: 8,
    },
    "& .MuiSlider-thumb": {
      height: 28,
      width: 28,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '2px solid currentColor',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      position: 'relative',
      '&:before': {
        boxShadow: 'none',
      },
      '&:after': {
        content: 'attr(data-emoji)',
        position: 'absolute',
        fontSize: '16px',
        fontWeight: 'normal',
        pointerEvents: 'none',
        userSelect: 'none',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        lineHeight: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 1,
        filter: shouldShowMonochrome ? 'grayscale(1)' : 'none',
      },
      '&:hover': {
        boxShadow: '0 0 0 8px rgba(25, 118, 210, 0.16)',
      },
      '&.Mui-focusVisible': {
        boxShadow: '0 0 0 8px rgba(25, 118, 210, 0.16)',
      },
    }
  };
};

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
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [editNameDialog, setEditNameDialog] = useState(false);
  const [currentName, setCurrentName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [existingEntryForDate, setExistingEntryForDate] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);

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
        setHasUserMadeChanges(false); // Reset since this is existing data
        setValues({
          overall: data.overall,
          wellbeing: data.wellbeing,
          growth: data.growth,
          relationships: data.relationships,
          impact: data.impact,
        });
      } else {
        // No entry for this date - show default or previous values
        setExistingEntryForDate(null);
        setHasUserMadeChanges(false); // Reset for new date with no entry

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  // Auto-save function with debouncing
  const autoSave = useCallback(async (valuesToSave) => {
    setLoading(true);
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
          ...valuesToSave,
        }),
      });

      if (response.ok) {
        await fetchHistoricalData();
        await fetchDataForDate();
      } else {
        let errorMessage = `Failed to save check-in (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If can't parse error response, use generic message
        }
        setSaveError(errorMessage);
        setTimeout(() => setSaveError(""), 3000);
      }
    } catch (error) {
      let errorMessage = "Unable to connect to server. Please check your internet connection and try again.";
      if (error.message) {
        errorMessage = `Save failed: ${error.message}`;
      }
      setSaveError(errorMessage);
      setTimeout(() => setSaveError(""), 3000);
    } finally {
      setLoading(false);
    }
  }, [userId, date, fetchHistoricalData, fetchDataForDate]);

  const handleSliderChange = (category, newValue) => {
    const newValues = {
      ...values,
      [category]: newValue,
    };

    setValues(newValues);

    // Mark that user has made changes (this will colorize all sliders)
    if (!hasUserMadeChanges) {
      setHasUserMadeChanges(true);
    }

    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Set new timeout for auto-save (debounce for 1 second)
    const timeout = setTimeout(() => {
      autoSave(newValues);
    }, 1000);

    setAutoSaveTimeout(timeout);
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
        backgroundColor: 'rgba(255,255,255,0.95)',
        titleColor: '#666',
        bodyColor: '#333',
        borderColor: 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        position: 'average',
        yAlign: 'bottom',
        xAlign: 'center',
        caretSize: 0,
        titleFont: {
          size: 11,
          weight: 'normal'
        },
        bodyFont: {
          size: 13,
          weight: 'bold'
        },
        padding: 6,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            const value = context.parsed.y;
            const emoji = emojiScale[value] || '😐';
            return `${value} ${emoji}`;
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
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
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
            mb: 1.5,
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
              mb: 1.5,
            }}
          >
            {currentName}
          </Typography>
        )}

        <Box sx={{ mb: 2 }}>
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

        {/* Helpful tip for new check-ins or auto-save confirmation */}
        <Box sx={{ mb: 2, textAlign: "center" }}>
          <Typography
            variant="body2"
            sx={{
              color: "#999",
              fontStyle: "italic",
              fontSize: "0.9rem",
              animation: existingEntryForDate
                ? "fadeIn 0.6s ease-out"
                : hasUserMadeChanges
                ? "fadeIn 0.8s ease-out"
                : "fadeInPulse 1.8s ease-out",
              "@keyframes fadeIn": {
                "0%": { opacity: 0, transform: "translateY(-10px)" },
                "100%": { opacity: 1, transform: "translateY(0)" }
              },
              "@keyframes fadeInPulse": {
                "0%": { opacity: 0, transform: "translateY(-10px)" },
                "40%": { opacity: 1, transform: "translateY(0)" },
                "50%": { opacity: 1, transform: "scale(1.05)" },
                "60%": { opacity: 1, transform: "scale(1)" },
                "70%": { opacity: 1, transform: "scale(1.03)" },
                "80%": { opacity: 1, transform: "scale(1)" },
                "100%": { opacity: 1, transform: "translateY(0)" }
              }
            }}
          >
            {existingEntryForDate
              ? "💾 All changes are saved automatically"
              : hasUserMadeChanges
              ? "💾 All changes are saved automatically"
              : `✨ Adjust the sliders to create a check-in for ${date === new Date().toISOString().split("T")[0] ? 'today' : 'this date'}`
            }
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
            },
            gap: 1.5,
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
                p: 2.5,
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
                  height: 40,
                  mb: 2,
                  overflow: "visible",
                }}
              >
                {historicalData.length > 1 && (
                  <Line
                    data={getSparklineData(category.key)}
                    options={sparklineOptions}
                  />
                )}
              </Box>

              <Box sx={{ px: 1, flexGrow: 1 }}>
                {/* Slider with emoji thumb */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2, // Add padding for thumb space
                  }}
                >
                  <Slider
                    value={values[category.key]}
                    onChange={(e, newValue) =>
                      handleSliderChange(category.key, newValue)
                    }
                    min={1}
                    max={10}
                    step={1}
                    marks
                    valueLabelDisplay="off"
                    sx={getEmojiSliderStyles(category.key, values, category.color, loading, !!existingEntryForDate, hasUserMadeChanges)}
                    componentsProps={{
                      thumb: {
                        'data-emoji': emojiScale[values[category.key]] || "😐"
                      }
                    }}
                  />
                </Box>

                {/* Category description below slider - always reserve space */}
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: "center",
                    color: hoveredCategory === category.key ? "#666" : "transparent",
                    mt: 1.5,
                    fontSize: "0.8rem",
                    fontStyle: "italic",
                    lineHeight: 1.2,
                    minHeight: "2.2em", // Reserve space for 2 lines
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
            mt: 1.5,
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

        <Box sx={{ mt: 2, textAlign: "center" }}>
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
