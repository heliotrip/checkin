import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  Autocomplete,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { PersonAdd, Login, TrendingUp, Edit } from "@mui/icons-material";

function HomePage() {
  const navigate = useNavigate();
  const [existingId, setExistingId] = useState("");
  const [recentIds, setRecentIds] = useState([]);
  const [idNames, setIdNames] = useState({});
  const [editNameDialog, setEditNameDialog] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    const storedIds = localStorage.getItem("checkin-recent-ids");
    if (storedIds) {
      try {
        setRecentIds(JSON.parse(storedIds));
      } catch (e) {
        console.error("Error parsing recent IDs:", e);
      }
    }

    const storedNames = localStorage.getItem("checkin-id-names");
    if (storedNames) {
      try {
        setIdNames(JSON.parse(storedNames));
      } catch (e) {
        console.error("Error parsing ID names:", e);
      }
    }
  }, []);

  const generateNewId = async () => {
    try {
      const response = await fetch("/api/generate-id");
      const data = await response.json();
      const newId = data.userId;

      addToRecentIds(newId);
      navigate(`/${newId}`);
    } catch (error) {
      console.error("Error generating ID:", error);
    }
  };

  const addToRecentIds = (id) => {
    const updated = [
      id,
      ...recentIds.filter((existingId) => existingId !== id),
    ];
    setRecentIds(updated);
    localStorage.setItem("checkin-recent-ids", JSON.stringify(updated));
  };

  const saveIdName = (id, name) => {
    const updated = { ...idNames };
    if (name.trim()) {
      updated[id] = name.trim();
    } else {
      delete updated[id];
    }
    setIdNames(updated);
    localStorage.setItem("checkin-id-names", JSON.stringify(updated));
  };

  const goToExistingId = () => {
    if (existingId.trim()) {
      let targetId = existingId.trim();

      // Check if input is a name - find corresponding ID
      const nameToId = Object.entries(idNames).find(
        ([id, name]) => name.toLowerCase() === targetId.toLowerCase(),
      );

      if (nameToId) {
        targetId = nameToId[0];
      }

      addToRecentIds(targetId);
      navigate(`/${targetId}`);
    }
  };

  const goToRecentId = (id) => {
    addToRecentIds(id);
    navigate(`/${id}`);
  };

  const openEditName = (id) => {
    setEditingId(id);
    setEditingName(idNames[id] || "");
    setEditNameDialog(true);
  };

  const handleSaveName = () => {
    saveIdName(editingId, editingName);
    setEditNameDialog(false);
    setEditingId("");
    setEditingName("");
  };

  const getAutocompleteOptions = () => {
    return [
      ...recentIds.map((id) => ({
        label: idNames[id]
          ? `${idNames[id]} (${id.substring(0, 8)}...)`
          : `${id.substring(0, 8)}...`,
        value: id,
        isName: !!idNames[id],
      })),
      ...Object.entries(idNames)
        .filter(([id]) => !recentIds.includes(id))
        .map(([id, name]) => ({
          label: `${name} (${id.substring(0, 8)}...)`,
          value: id,
          isName: true,
        })),
    ];
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              color: "#1976d2",
              fontWeight: "bold",
              mb: 2,
            }}
          >
            Checkin
          </Typography>

          <Typography
            variant="h5"
            gutterBottom
            sx={{
              color: "#666",
              mb: 3,
            }}
          >
            Track your 1-1 check-ins over time
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: "#888",
              maxWidth: 600,
              mx: "auto",
              lineHeight: 1.6,
            }}
          >
            Follow your team members' status across five key areas: Overall,
            Wellbeing, Growth, Relationships, and Impact. Each ID represents an
            anonymous team member's journey over time.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3, textAlign: "center" }}>
                <PersonAdd sx={{ fontSize: 48, color: "#1976d2", mb: 2 }} />
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ fontWeight: "bold" }}
                >
                  Create New ID
                </Typography>
                <Typography variant="body2" sx={{ color: "#666", mb: 3 }}>
                  Generate a new anonymous ID for tracking check-ins
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={generateNewId}
                  fullWidth
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: "bold",
                  }}
                >
                  Generate New ID
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3, textAlign: "center" }}>
                <Login sx={{ fontSize: 48, color: "#388e3c", mb: 2 }} />
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ fontWeight: "bold" }}
                >
                  Access Existing ID
                </Typography>
                <Typography variant="body2" sx={{ color: "#666", mb: 3 }}>
                  Enter an ID or team member name
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Autocomplete
                    freeSolo
                    options={getAutocompleteOptions()}
                    value={existingId}
                    onChange={(event, newValue) => {
                      if (typeof newValue === "string") {
                        setExistingId(newValue);
                      } else if (newValue && newValue.value) {
                        setExistingId(newValue.value);
                      } else {
                        setExistingId("");
                      }
                    }}
                    onInputChange={(event, newInputValue) => {
                      setExistingId(newInputValue);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Enter ID or Name"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            goToExistingId();
                          }
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                          }}
                        >
                          <Typography variant="body2">
                            {option.label}
                          </Typography>
                          {option.isName && (
                            <Chip
                              label="Named"
                              size="small"
                              sx={{ ml: "auto", fontSize: "0.7rem" }}
                            />
                          )}
                        </Box>
                      </Box>
                    )}
                  />
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={goToExistingId}
                  disabled={!existingId.trim()}
                  fullWidth
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: "bold",
                    bgcolor: "#388e3c",
                    "&:hover": {
                      bgcolor: "#2e7d32",
                    },
                  }}
                >
                  Access ID
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {recentIds.length > 0 && (
          <>
            <Divider sx={{ my: 4 }} />
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: "#666",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <TrendingUp sx={{ mr: 1 }} />
                Recent IDs
              </Typography>
              <Grid container spacing={2}>
                {recentIds.map((id, index) => (
                  <Grid item xs={12} sm={6} md={4} key={id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Button
                        variant="outlined"
                        onClick={() => goToRecentId(id)}
                        sx={{
                          py: 1.5,
                          flexGrow: 1,
                          justifyContent: "flex-start",
                          textAlign: "left",
                        }}
                      >
                        <Box>
                          {idNames[id] && (
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: "bold" }}
                            >
                              {idNames[id]}
                            </Typography>
                          )}
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "monospace",
                              color: "text.secondary",
                            }}
                          >
                            {id.substring(0, 8)}...
                          </Typography>
                        </Box>
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => openEditName(id)}
                        sx={{ ml: 1 }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        )}

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Typography variant="body2" sx={{ color: "#999" }}>
            All IDs are anonymous and stored locally for privacy
          </Typography>
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
            ID: {editingId.substring(0, 8)}...
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

export default HomePage;
