from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import AutomationRule, Scene, Device
from ..schemas import (
    AutomationRuleCreate, AutomationRuleOut,
    SceneCreate, SceneOut
)
from ..services.automation_engine import execute_scene

router = APIRouter(prefix="/api/automations", tags=["automations"])

# Rules CRUD
@router.get("/rules", response_model=list[AutomationRuleOut])
async def list_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AutomationRule).order_by(AutomationRule.id))
    rules = result.scalars().all()
    # Eager load target_device
    for r in rules:
        if r.target_device_id:
            await db.refresh(r, ["target_device"])
    return rules

@router.post("/rules", response_model=AutomationRuleOut, status_code=201)
async def create_rule(payload: AutomationRuleCreate, db: AsyncSession = Depends(get_db)):
    device = await db.get(Device, payload.target_device_id)
    if not device:
        raise HTTPException(404, "Target device not found")
    rule = AutomationRule(**payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule, ["target_device"])
    return rule

@router.patch("/rules/{rule_id}/toggle", response_model=AutomationRuleOut)
async def toggle_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    rule = await db.get(AutomationRule, rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.is_enabled = not rule.is_enabled
    await db.commit()
    await db.refresh(rule, ["target_device"])
    return rule

@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    rule = await db.get(AutomationRule, rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()

# Scenes CRUD
@router.get("/scenes", response_model=list[SceneOut])
async def list_scenes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scene).order_by(Scene.id))
    return result.scalars().all()

@router.post("/scenes", response_model=SceneOut, status_code=201)
async def create_scene(payload: SceneCreate, db: AsyncSession = Depends(get_db)):
    scene = Scene(
        name=payload.name,
        icon=payload.icon,
        description=payload.description,
        actions=[a.model_dump() for a in payload.actions]
    )
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene

@router.post("/scenes/{scene_id}/apply", response_model=SceneOut)
async def apply_scene(scene_id: int, db: AsyncSession = Depends(get_db)):
    scene = await execute_scene(db, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    return scene

@router.delete("/scenes/{scene_id}", status_code=204)
async def delete_scene(scene_id: int, db: AsyncSession = Depends(get_db)):
    scene = await db.get(Scene, scene_id)
    if not scene:
        raise HTTPException(404, "Scene not found")
    await db.delete(scene)
    await db.commit()
