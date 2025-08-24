"""
API schema definitions for the Math Expression Rewriting API.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Union
from enum import Enum


class ExpressionFormat(str, Enum):
    """Supported expression input/output formats."""
    LATEX = "latex"
    MATHML = "mathml"
    SYMPY = "sympy"
    PLAIN_TEXT = "plain_text"


class RewriteRule(str, Enum):
    """Available rewrite rules for expression transformation."""
    SIMPLIFY = "simplify"
    EXPAND = "expand"
    FACTOR = "factor"
    COLLECT = "collect"
    TRIGSIMP = "trigsimp"
    RATIONALIZE = "rationalize"
    CANCEL = "cancel"


class ParseRequest(BaseModel):
    """Request model for parsing mathematical expressions."""
    expression: str = Field(..., description="Mathematical expression to parse")
    input_format: ExpressionFormat = Field(
        default=ExpressionFormat.LATEX,
        description="Format of the input expression"
    )
    output_format: ExpressionFormat = Field(
        default=ExpressionFormat.MATHML,
        description="Desired output format"
    )


class ParseResponse(BaseModel):
    """Response model for expression parsing."""
    success: bool = Field(..., description="Whether parsing was successful")
    parsed_expression: Optional[str] = Field(
        None, description="Parsed expression in requested format"
    )
    ast_structure: Optional[Dict] = Field(
        None, description="Abstract syntax tree representation"
    )
    variables: List[str] = Field(
        default=[], description="Variables found in the expression"
    )
    error_message: Optional[str] = Field(
        None, description="Error message if parsing failed"
    )


class RewriteRequest(BaseModel):
    """Request model for rewriting mathematical expressions."""
    expression: str = Field(..., description="Mathematical expression to rewrite")
    rules: List[RewriteRule] = Field(
        ..., description="List of rewrite rules to apply"
    )
    input_format: ExpressionFormat = Field(
        default=ExpressionFormat.LATEX,
        description="Format of the input expression"
    )
    output_format: ExpressionFormat = Field(
        default=ExpressionFormat.MATHML,
        description="Desired output format"
    )
    variables: Optional[Dict[str, Union[str, float, int]]] = Field(
        None, description="Variable substitutions to apply"
    )


class RewriteStep(BaseModel):
    """Individual step in the rewriting process."""
    rule: RewriteRule = Field(..., description="Rule applied in this step")
    expression_before: str = Field(..., description="Expression before this step")
    expression_after: str = Field(..., description="Expression after this step")
    description: str = Field(..., description="Human-readable description of the step")


class RewriteResponse(BaseModel):
    """Response model for expression rewriting."""
    success: bool = Field(..., description="Whether rewriting was successful")
    original_expression: str = Field(..., description="Original input expression")
    final_expression: Optional[str] = Field(
        None, description="Final rewritten expression"
    )
    steps: List[RewriteStep] = Field(
        default=[], description="Step-by-step rewriting process"
    )
    mathml_output: Optional[str] = Field(
        None, description="Final expression in MathML format"
    )
    latex_output: Optional[str] = Field(
        None, description="Final expression in LaTeX format"
    )
    error_message: Optional[str] = Field(
        None, description="Error message if rewriting failed"
    )


class RewriteOption(BaseModel):
    id: str
    label: str
    ruleName: str
    replacementContentMathML: str
    replacementPresentationMathML: str


class RewriteOptionsRequest(BaseModel):
    contentMathML: str
    selectedNodeId: str


class RewriteOptionsResponse(BaseModel):
    options: List[RewriteOption]