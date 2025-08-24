"""
Tests for the main FastAPI application endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from schemas import ParseRequest, RewriteRequest, RewriteRule, ExpressionFormat

client = TestClient(app)


def test_root_endpoint():
    """Test the root endpoint returns Hello World message."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Hello World from Math Expression Rewriting API"
    assert data["status"] == "running"
    assert data["version"] == "1.0.0"


def test_health_check_endpoint():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "services" in data
    assert "fastapi" in data["services"]
    assert "sympy" in data["services"]
    assert "lxml" in data["services"]


def test_parse_endpoint_basic():
    """Test basic parsing functionality."""
    request_data = {
        "expression": "x^2 + 2*x + 1",
        "input_format": "plain_text",
        "output_format": "latex"
    }
    response = client.post("/api/parse", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["parsed_expression"] is not None
    assert "x" in data["variables"]


def test_parse_endpoint_error_handling():
    """Test parse endpoint error handling with invalid expression."""
    request_data = {
        "expression": "invalid_expression_@#$%",
        "input_format": "plain_text",
        "output_format": "latex"
    }
    response = client.post("/api/parse", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["error_message"] is not None


def test_rewrite_endpoint_basic():
    """Test basic rewrite functionality."""
    request_data = {
        "expression": "x^2 + 2*x + 1",
        "rules": ["factor"],
        "input_format": "plain_text",
        "output_format": "latex"
    }
    response = client.post("/api/rewrite", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["original_expression"] is not None
    assert data["final_expression"] is not None
    assert len(data["steps"]) > 0
    assert data["steps"][0]["rule"] == "factor"


def test_rewrite_endpoint_multiple_rules():
    """Test rewrite with multiple rules."""
    request_data = {
        "expression": "(x + 1)^2",
        "rules": ["expand", "simplify"],
        "input_format": "plain_text",
        "output_format": "latex"
    }
    response = client.post("/api/rewrite", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["steps"]) == 2
    assert data["steps"][0]["rule"] == "expand"
    assert data["steps"][1]["rule"] == "simplify"


def test_rewrite_endpoint_error_handling():
    """Test rewrite endpoint error handling."""
    request_data = {
        "expression": "invalid_expression_@#$%",
        "rules": ["simplify"],
        "input_format": "plain_text",
        "output_format": "latex"
    }
    response = client.post("/api/rewrite", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["error_message"] is not None