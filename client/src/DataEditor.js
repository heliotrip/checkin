import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import { Download, Upload, Save, Delete, ArrowBack, ContentCopy } from '@mui/icons-material';

function DataEditor() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [csvData, setCsvData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const loadCurrentName = useCallback(() => {
    const storedNames = localStorage.getItem('checkin-id-names');
    if (storedNames) {
      try {
        const names = JSON.parse(storedNames);
        setCurrentName(names[userId] || '');
      } catch (e) {
        console.error('Error parsing ID names:', e);
      }
    }
  }, [userId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/checkins/${userId}`);
      const data = await response.json();

      if (data.length === 0) {
        setCsvData('date,overall,wellbeing,growth,relationships,impact\n');
      } else {
        // Convert to CSV format
        const headers = 'date,overall,wellbeing,growth,relationships,impact';
        const csvRows = data.map(row =>
          `${row.date},${row.overall},${row.wellbeing},${row.growth},${row.relationships},${row.impact}`
        );
        setCsvData(headers + '\n' + csvRows.join('\n'));
      }
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }
    loadData();
    loadCurrentName();
  }, [userId, navigate, loadData, loadCurrentName]);

  const downloadCSV = () => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `checkin-data-${userId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvData(e.target.result);
      };
      reader.readAsText(file);
    } else {
      setError('Please select a valid CSV file');
    }
    // Reset the input
    event.target.value = '';
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const validateCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 1) {
      throw new Error('CSV must have at least a header row');
    }

    const headers = lines[0].toLowerCase().split(',');
    const expectedHeaders = ['date', 'overall', 'wellbeing', 'growth', 'relationships', 'impact'];

    if (!expectedHeaders.every(header => headers.includes(header))) {
      throw new Error(`CSV must include these columns: ${expectedHeaders.join(', ')}`);
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue; // Skip empty lines

      const values = lines[i].split(',');
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1} has incorrect number of columns`);
      }

      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index].trim();
      });

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        throw new Error(`Row ${i + 1}: Date must be in YYYY-MM-DD format`);
      }

      // Validate numeric values
      ['overall', 'wellbeing', 'growth', 'relationships', 'impact'].forEach(field => {
        const value = parseInt(row[field]);
        if (isNaN(value) || value < 1 || value > 10) {
          throw new Error(`Row ${i + 1}: ${field} must be a number between 1 and 10`);
        }
        row[field] = value;
      });

      data.push(row);
    }

    return data;
  };

  const saveData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate CSV data
      const validatedData = validateCSV(csvData);

      // Send to backend
      const response = await fetch(`/api/checkins/${userId}/bulk`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: validatedData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      setSuccess(`Successfully saved ${validatedData.length} records`);
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteAllData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/checkins/${userId}/bulk`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      setCsvData('date,overall,wellbeing,growth,relationships,impact\n');
      setSuccess('All data deleted successfully');
      setDeleteDialog(false);
    } catch (err) {
      setError('Delete failed: ' + err.message);
      setDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(`/${userId}`)}
            sx={{ mr: 2 }}
          >
            Back to Check-in
          </Button>
          <Typography variant="h4" component="h1" sx={{
            color: '#1976d2',
            fontWeight: 'bold',
            flexGrow: 1
          }}>
            Data Editor
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ color: '#666' }}>
              Edit all check-in data for ID: {userId.substring(0, 8)}...
            </Typography>
            <Tooltip title={copySuccess ? "Copied!" : "Copy ID"}>
              <IconButton onClick={copyToClipboard} color="primary" size="small">
                <ContentCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {currentName && (
            <Typography
              variant="h5"
              sx={{
                color: '#1976d2',
                fontWeight: 'bold',
              }}
            >
              {currentName}
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadCSV}
            disabled={loading}
          >
            Download CSV
          </Button>

          <Button
            variant="outlined"
            component="label"
            startIcon={<Upload />}
            disabled={loading}
          >
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </Button>

          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={saveData}
            disabled={loading}
            sx={{ ml: 'auto' }}
          >
            Save All Data
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            onClick={() => setDeleteDialog(true)}
            disabled={loading}
          >
            Delete All
          </Button>
        </Box>

        <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
          CSV Format: date,overall,wellbeing,growth,relationships,impact
          <br />
          Date format: YYYY-MM-DD, Values: 1-10
        </Typography>

        <TextField
          multiline
          fullWidth
          rows={20}
          value={csvData}
          onChange={(e) => setCsvData(e.target.value)}
          variant="outlined"
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '0.9rem'
            }
          }}
          placeholder="date,overall,wellbeing,growth,relationships,impact&#10;2025-01-01,5,5,5,5,5&#10;2025-01-02,6,5,7,5,8"
        />

        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: '#999' }}>
          Note: Saving will replace ALL existing data for this user. Clear the text area and save to delete all data.
        </Typography>
      </Paper>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete All Data</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all check-in data for this user? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={deleteAllData} color="error" variant="contained">
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default DataEditor;