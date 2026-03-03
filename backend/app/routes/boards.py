"""
Kanban Boards API - Visual task management with drag-and-drop columns.

Endpoints:
- GET /api/boards - List boards
- POST /api/boards - Create board
- GET /api/boards/{board_id} - Get board with columns and cards
- PATCH /api/boards/{board_id} - Update board
- DELETE /api/boards/{board_id} - Delete board
- POST /api/boards/{board_id}/columns - Add column
- PATCH /api/boards/{board_id}/columns/{column_id} - Update column
- DELETE /api/boards/{board_id}/columns/{column_id} - Delete column
- POST /api/boards/{board_id}/cards - Add card
- PATCH /api/boards/{board_id}/cards/{card_id} - Update card (move)
- DELETE /api/boards/{board_id}/cards/{card_id} - Delete card
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

router = APIRouter()

Base = declarative_base()
engine = create_engine("sqlite:////Users/jarvis-openclaw/dashboard-vision/backend/dashboard.db")
SessionLocal = sessionmaker(bind=engine)


class BoardModel(Base):
    __tablename__ = "boards"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ColumnModel(Base):
    __tablename__ = "board_columns"
    
    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    name = Column(String, nullable=False)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CardModel(Base):
    __tablename__ = "board_cards"
    
    id = Column(Integer, primary_key=True)
    column_id = Column(Integer, ForeignKey("board_columns.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    agent_id = Column(String, nullable=True)
    task_id = Column(Integer, nullable=True)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(engine)


class Card(BaseModel):
    id: Optional[int] = None
    column_id: int
    title: str
    description: Optional[str] = None
    agent_id: Optional[str] = None
    task_id: Optional[int] = None
    position: int = 0
    created_at: Optional[datetime] = None


class Column(BaseModel):
    id: Optional[int] = None
    board_id: int
    name: str
    position: int = 0
    cards: List[Card] = []
    created_at: Optional[datetime] = None


class Board(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    columns: List[Column] = []
    created_at: Optional[datetime] = None


class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ColumnCreate(BaseModel):
    name: str
    position: Optional[int] = None


class CardCreate(BaseModel):
    column_id: int
    title: str
    description: Optional[str] = None
    agent_id: Optional[str] = None
    task_id: Optional[int] = None


class CardMove(BaseModel):
    column_id: int
    position: int


@router.get("", response_model=List[Board])
async def list_boards():
    """List all boards."""
    db = SessionLocal()
    try:
        boards = db.query(BoardModel).all()
        result = []
        for b in boards:
            columns = db.query(ColumnModel).filter_by(board_id=b.id).order_by(ColumnModel.position).all()
            cols = []
            for col in columns:
                cards = db.query(CardModel).filter_by(column_id=col.id).order_by(CardModel.position).all()
                cols.append(Column(
                    id=col.id,
                    board_id=col.board_id,
                    name=col.name,
                    position=col.position,
                    cards=[Card(
                        id=c.id,
                        column_id=c.column_id,
                        title=c.title,
                        description=c.description,
                        agent_id=c.agent_id,
                        task_id=c.task_id,
                        position=c.position,
                        created_at=c.created_at,
                    ) for c in cards],
                    created_at=col.created_at,
                ))
            result.append(Board(
                id=b.id,
                name=b.name,
                description=b.description,
                columns=cols,
                created_at=b.created_at,
            ))
        return result
    finally:
        db.close()


@router.post("", response_model=Board)
async def create_board(data: BoardCreate):
    """Create a new board."""
    db = SessionLocal()
    try:
        board = BoardModel(name=data.name, description=data.description)
        db.add(board)
        db.commit()
        db.refresh(board)
        
        # Add default columns
        for i, name in enumerate(["To Do", "In Progress", "Done"]):
            col = ColumnModel(board_id=board.id, name=name, position=i)
            db.add(col)
        db.commit()
        
        return Board(
            id=board.id,
            name=board.name,
            description=board.description,
            columns=[],
            created_at=board.created_at,
        )
    finally:
        db.close()


@router.get("/{board_id}", response_model=Board)
async def get_board(board_id: int):
    """Get board with all columns and cards."""
    db = SessionLocal()
    try:
        board = db.query(BoardModel).filter_by(id=board_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        columns = db.query(ColumnModel).filter_by(board_id=board_id).order_by(ColumnModel.position).all()
        cols = []
        for col in columns:
            cards = db.query(CardModel).filter_by(column_id=col.id).order_by(CardModel.position).all()
            cols.append(Column(
                id=col.id,
                board_id=col.board_id,
                name=col.name,
                position=col.position,
                cards=[Card(
                    id=c.id,
                    column_id=c.column_id,
                    title=c.title,
                    description=c.description,
                    agent_id=c.agent_id,
                    task_id=c.task_id,
                    position=c.position,
                    created_at=c.created_at,
                ) for c in cards],
                created_at=col.created_at,
            ))
        
        return Board(
            id=board.id,
            name=board.name,
            description=board.description,
            columns=cols,
            created_at=board.created_at,
        )
    finally:
        db.close()


@router.delete("/{board_id}")
async def delete_board(board_id: int):
    """Delete board and all its columns/cards."""
    db = SessionLocal()
    try:
        board = db.query(BoardModel).filter_by(id=board_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        
        # Cascade delete
        columns = db.query(ColumnModel).filter_by(board_id=board_id).all()
        for col in columns:
            db.query(CardModel).filter_by(column_id=col.id).delete()
        db.query(ColumnModel).filter_by(board_id=board_id).delete()
        db.delete(board)
        db.commit()
        
        return {"status": "deleted", "id": board_id}
    finally:
        db.close()


@router.post("/{board_id}/cards", response_model=Card)
async def create_card(board_id: int, data: CardCreate):
    """Add card to a column."""
    db = SessionLocal()
    try:
        col = db.query(ColumnModel).filter_by(id=data.column_id, board_id=board_id).first()
        if not col:
            raise HTTPException(status_code=404, detail="Column not found")
        
        # Get max position
        max_pos = db.query(CardModel).filter_by(column_id=data.column_id).count()
        
        card = CardModel(
            column_id=data.column_id,
            title=data.title,
            description=data.description,
            agent_id=data.agent_id,
            task_id=data.task_id,
            position=max_pos,
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        
        return Card(
            id=card.id,
            column_id=card.column_id,
            title=card.title,
            description=card.description,
            agent_id=card.agent_id,
            task_id=card.task_id,
            position=card.position,
            created_at=card.created_at,
        )
    finally:
        db.close()


@router.patch("/{board_id}/cards/{card_id}")
async def move_card(board_id: int, card_id: int, data: CardMove):
    """Move card to different column/position."""
    db = SessionLocal()
    try:
        card = db.query(CardModel).filter_by(id=card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        
        card.column_id = data.column_id
        card.position = data.position
        db.commit()
        
        return {"status": "moved", "card_id": card_id}
    finally:
        db.close()


@router.delete("/{board_id}/cards/{card_id}")
async def delete_card(board_id: int, card_id: int):
    """Delete card."""
    db = SessionLocal()
    try:
        card = db.query(CardModel).filter_by(id=card_id).first()
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        
        db.delete(card)
        db.commit()
        return {"status": "deleted", "id": card_id}
    finally:
        db.close()
