import React, { useState, useEffect } from "react";
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
  { key: "overall", label: "Overall", color: "#1976d2" },
  { key: "wellbeing", label: "Wellbeing", color: "#388e3c" },
  { key: "growth", label: "Growth", color: "#f57c00" },
  { key: "relationships", label: "Relationships", color: "#e91e63" },
  { key: "impact", label: "Impact", color: "#7b1fa2" },
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

  const loadCurrentName = () => {
    const storedNames = localStorage.getItem("checkin-id-names");
    if (storedNames) {
      try {
        const names = JSON.parse(storedNames);
        setCurrentName(names[userId] || "");
      } catch (e) {
        console.error("Error parsing ID names:", e);
      }
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`/api/checkins/${userId}`);
      const data = await response.json();
      setHistoricalData(data);
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  };

  const fetchDataForDate = async () => {
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
  };

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }
    fetchHistoricalData();
    fetchDataForDate();
    loadCurrentName();
  }, [userId, date, navigate]);

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
        console.error("Error saving check-in");
      }
    } catch (error) {
      console.error("Error saving check-in:", error);
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
          pointRadius: 0,
          pointHoverRadius: 4,
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
        enabled: false,
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
        min: 0.5,
        max: 10.5,
        grid: {
          display: false,
        },
      },
    },
    elements: {
      point: {
        radius: 0,
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
              sx={{
                p: 3,
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  textAlign: "center",
                  color: category.color,
                  fontWeight: "bold",
                  mb: 2,
                }}
              >
                {category.label}
              </Typography>

              <Box
                sx={{
                  width: "100%",
                  height: 50,
                  mb: 2,
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
