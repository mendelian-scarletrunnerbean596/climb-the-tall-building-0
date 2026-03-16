import { create } from 'zustand';
import type { CardInstance, EnemyInstance, MapNode, GamePhase, PlayerState, FloatingText, StatusEffects } from '../types';
import { getCardDef, getStarterDeck, getRewardCards } from './cards';
import { ENEMY_DEFS, getEncounter } from './enemies';
import type { EncounterType } from './enemies';
import { generateMap } from './map';
import { emptyStatus } from '../types';

let uidCounter = 0;
function uid() { return `uid-${++uidCounter}-${Math.random().toString(36).slice(2, 7)}`; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface GameState {
  // Phase
  phase: GamePhase;
  previousPhase: GamePhase | null;

  // Player
  player: PlayerState;
  deck: CardInstance[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];

  // Combat
  enemies: EnemyInstance[];
  turn: number;
  isEnemyTurn: boolean;
  selectedCardUid: string | null;

  // Map
  map: MapNode[];
  currentNodeId: string | null;
  currentRow: number;
  currentEventId: string | null;

  // Rewards
  rewardCardIds: string[];

  // UI
  floatingTexts: FloatingText[];
  screenShake: number;

  // Stats
  act: number;
  floorsCleared: number;
  cardsPlayed: number;
  damageDealt: number;

  // Actions
  startRun: () => void;
  setPhase: (phase: GamePhase) => void;
  selectMapNode: (nodeId: string) => void;
  startCombat: (encounterType: EncounterType) => void;
  drawCards: (count: number) => void;
  playCard: (cardUid: string, targetEnemyId?: string) => void;
  endPlayerTurn: () => void;
  executeEnemyTurn: () => void;
  selectCard: (uid: string | null) => void;
  addRewardCard: (defId: string) => void;
  skipReward: () => void;
  rest: () => void;
  upgradeCard: (cardUid: string) => void;
  addFloatingText: (text: string, x: number, y: number, color: string) => void;
  tick: (dt: number) => void;
  returnToMainMenu: () => void;
  applyEventOutcome: (outcome: { hp?: number; maxHp?: number; gold?: number; upgradeRandom?: boolean }) => void;
}

function calcDamage(base: number, attacker: StatusEffects, defender: StatusEffects): number {
  let dmg = base + attacker.strength;
  if (attacker.weak > 0) dmg = Math.floor(dmg * 0.75);
  if (defender.vulnerable > 0) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

function applyDamageToTarget(hp: number, block: number, damage: number): { hp: number; block: number; overkill: number } {
  let remaining = damage;
  let newBlock = block;
  let newHp = hp;
  
  if (newBlock > 0) {
    if (newBlock >= remaining) {
      newBlock -= remaining;
      remaining = 0;
    } else {
      remaining -= newBlock;
      newBlock = 0;
    }
  }
  
  newHp = Math.max(0, newHp - remaining);
  return { hp: newHp, block: newBlock, overkill: remaining };
}

function decrementStatus(status: StatusEffects): StatusEffects {
  return {
    ...status,
    vulnerable: Math.max(0, status.vulnerable - 1),
    weak: Math.max(0, status.weak - 1),
  };
}

const defaultPlayer: PlayerState = {
  hp: 80,
  maxHp: 80,
  block: 0,
  energy: 3,
  maxEnergy: 3,
  gold: 99,
  status: emptyStatus(),
};

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'main_menu',
  previousPhase: null,
  player: { ...defaultPlayer },
  deck: [],
  hand: [],
  drawPile: [],
  discardPile: [],
  exhaustPile: [],
  enemies: [],
  turn: 0,
  isEnemyTurn: false,
  selectedCardUid: null,
  map: [],
  currentNodeId: null,
  currentRow: -1,
  currentEventId: null,
  rewardCardIds: [],
  floatingTexts: [],
  screenShake: 0,
  act: 1,
  floorsCleared: 0,
  cardsPlayed: 0,
  damageDealt: 0,

  startRun: () => {
    uidCounter = 0;
    const deckDefs = getStarterDeck();
    const deck: CardInstance[] = deckDefs.map(d => ({ uid: uid(), defId: d.defId, upgraded: d.upgraded }));
    const map = generateMap();

    set({
      phase: 'map',
      player: { ...defaultPlayer },
      deck,
      hand: [],
      drawPile: [],
      discardPile: [],
      exhaustPile: [],
      enemies: [],
      turn: 0,
      isEnemyTurn: false,
      selectedCardUid: null,
      map,
      currentNodeId: null,
      currentRow: -1,
      currentEventId: null,
      rewardCardIds: [],
      floatingTexts: [],
      screenShake: 0,
      act: 1,
      floorsCleared: 0,
      cardsPlayed: 0,
      damageDealt: 0,
    });
  },

  setPhase: (phase) => {
    set(s => ({ phase, previousPhase: s.phase }));
  },

  selectMapNode: (nodeId) => {
    const state = get();
    const node = state.map.find(n => n.id === nodeId);
    if (!node) return;

    // Validate it's a valid move
    if (state.currentRow === -1) {
      // Must be row 0
      if (node.row !== 0) return;
    } else {
      const currentNode = state.map.find(n => n.id === state.currentNodeId);
      if (!currentNode || !currentNode.connections.includes(nodeId)) return;
    }

    // Mark visited
    set(s => ({
      map: s.map.map(n => n.id === nodeId ? { ...n, visited: true } : n),
      currentNodeId: nodeId,
      currentRow: node.row,
    }));

    switch (node.type) {
      case 'combat':
        get().startCombat('normal');
        break;
      case 'elite':
        get().startCombat('elite');
        break;
      case 'boss':
        get().startCombat('boss');
        break;
      case 'rest':
        set({ phase: 'rest' });
        break;
      case 'event':
        const eventIds = ['shrine', 'cleric', 'thieves', 'golden_idol', 'upgrade_shrine'];
        const randomEventId = eventIds[Math.floor(Math.random() * eventIds.length)];
        set({ phase: 'event', currentEventId: randomEventId });
        break;
      case 'shop':
        // Simplified: give gold and go back to map
        set(s => ({
          player: { ...s.player, gold: s.player.gold + 50 },
          phase: 'event',
        }));
        break;
      default:
        break;
    }
  },

  startCombat: (encounterType) => {
    const state = get();
    const encounter = getEncounter(encounterType);
    
    const enemies: EnemyInstance[] = encounter.enemies.map((defId, i) => {
      const def = ENEMY_DEFS[defId];
      const variance = def.hpVariance ? Math.floor(Math.random() * def.hpVariance * 2) - def.hpVariance : 0;
      const hp = def.hp + variance;
      const enemy: EnemyInstance = {
        id: `enemy-${i}-${uid()}`,
        defId,
        name: def.name,
        hp,
        maxHp: hp,
        block: 0,
        status: defId === 'cultist' ? { ...emptyStatus(), ritual: 3 } : emptyStatus(),
        intent: def.getIntent(0, null as unknown as EnemyInstance),
        turnCounter: 0,
      };
      return enemy;
    });

    // Prepare draw pile
    const drawPile = shuffle([...state.deck]);

    set({
      phase: 'combat',
      enemies,
      turn: 1,
      isEnemyTurn: false,
      selectedCardUid: null,
      hand: [],
      drawPile,
      discardPile: [],
      exhaustPile: [],
      player: { ...state.player, block: 0, energy: state.player.maxEnergy, status: emptyStatus() },
    });

    // Draw initial hand
    setTimeout(() => get().drawCards(5), 300);
  },

  drawCards: (count) => {
    set(state => {
      let newDraw = [...state.drawPile];
      let newDiscard = [...state.discardPile];
      const newHand = [...state.hand];

      for (let i = 0; i < count; i++) {
        if (newDraw.length === 0) {
          if (newDiscard.length === 0) break;
          newDraw = shuffle(newDiscard);
          newDiscard = [];
        }
        const card = newDraw.pop()!;
        newHand.push(card);
      }

      return { hand: newHand, drawPile: newDraw, discardPile: newDiscard };
    });
  },

  playCard: (cardUid, targetEnemyId) => {
    const state = get();
    if (state.isEnemyTurn || state.phase !== 'combat') return;

    const cardIndex = state.hand.findIndex(c => c.uid === cardUid);
    if (cardIndex === -1) return;

    const cardInst = state.hand[cardIndex];
    const def = getCardDef(cardInst.defId, cardInst.upgraded);

    // Check energy
    if (def.cost > state.player.energy) return;

    let newPlayer = { ...state.player, energy: state.player.energy - def.cost };
    let newEnemies = [...state.enemies];
    const newHand = state.hand.filter(c => c.uid !== cardUid);
    let newDiscard = [...state.discardPile, cardInst];
    let cardsDrawn = 0;

    // ─── Block ───────────────
    if (def.block) {
      newPlayer.block += def.block;
    }

    // ─── Strength (self) ─────
    if (def.applyStrength) {
      newPlayer.status = { ...newPlayer.status, strength: newPlayer.status.strength + def.applyStrength };
    }

    // ─── Flame Barrier (thorns) ─────
    if (def.id === 'flame_barrier') {
      newPlayer.status = { ...newPlayer.status, thorns: newPlayer.status.thorns + 4 };
    }

    // ─── Sentinel (metallicize) ─────
    if (def.id === 'sentinel') {
      newPlayer.status = { ...newPlayer.status, metallicize: newPlayer.status.metallicize + 5 };
    }

    // ─── Bloodletting ─────
    if (def.id === 'bloodletting') {
      newPlayer.hp = Math.max(1, newPlayer.hp - 3);
      const energyGain = cardInst.upgraded ? 3 : 2;
      newPlayer.energy += energyGain;
    }

    // ─── Damage ──────────────
    if (def.damage !== undefined && def.damage >= 0) {
      const isBodySlam = def.id === 'body_slam';
      const baseDmg = isBodySlam ? newPlayer.block : def.damage;
      const hits = def.hits || 1;
      const isAoe = def.aoe;

      if (isAoe) {
        for (let h = 0; h < hits; h++) {
          newEnemies = newEnemies.map(e => {
            if (e.hp <= 0) return e;
            const dmg = calcDamage(baseDmg, newPlayer.status, e.status);
            const result = applyDamageToTarget(e.hp, e.block, dmg);
            
            let newStatus = { ...e.status };
            if (def.applyVulnerable) newStatus.vulnerable += def.applyVulnerable;
            if (def.applyWeak) newStatus.weak += def.applyWeak;

            return { ...e, hp: result.hp, block: result.block, status: newStatus };
          });
        }
      } else {
        // Single target
        const targetId = targetEnemyId || newEnemies.find(e => e.hp > 0)?.id;
        if (targetId) {
          for (let h = 0; h < hits; h++) {
            newEnemies = newEnemies.map(e => {
              if (e.id !== targetId || e.hp <= 0) return e;
              const dmg = calcDamage(baseDmg, newPlayer.status, e.status);
              const result = applyDamageToTarget(e.hp, e.block, dmg);

              let newStatus = { ...e.status };
              if (def.applyVulnerable) newStatus.vulnerable += def.applyVulnerable;
              if (def.applyWeak) newStatus.weak += def.applyWeak;

              return { ...e, hp: result.hp, block: result.block, status: newStatus };
            });
          }
        }
      }
    }

    // ─── Draw ────────────────
    if (def.draw) cardsDrawn = def.draw;

    set({
      player: newPlayer,
      enemies: newEnemies,
      hand: newHand,
      discardPile: newDiscard,
      selectedCardUid: null,
      cardsPlayed: state.cardsPlayed + 1,
    });

    if (cardsDrawn > 0) {
      setTimeout(() => get().drawCards(cardsDrawn), 150);
    }

    // Check if all enemies dead
    setTimeout(() => {
      const s = get();
      const allDead = s.enemies.every(e => e.hp <= 0);
      if (allDead && s.phase === 'combat') {
        const rewardCardIds = getRewardCards(3);
        set({
          phase: 'combat_reward',
          rewardCardIds,
          floorsCleared: s.floorsCleared + 1,
          player: { ...s.player, gold: s.player.gold + 15 + Math.floor(Math.random() * 10) },
        });
      }
    }, 200);
  },

  endPlayerTurn: () => {
    const state = get();
    if (state.isEnemyTurn || state.phase !== 'combat') return;

    // Discard hand
    set(s => ({
      discardPile: [...s.discardPile, ...s.hand],
      hand: [],
      isEnemyTurn: true,
    }));

    setTimeout(() => get().executeEnemyTurn(), 600);
  },

  executeEnemyTurn: () => {
    const state = get();
    let newPlayer = { ...state.player };

    // End of player turn effects (e.g. Metallicize)
    if (newPlayer.status.metallicize > 0) {
      newPlayer.block += newPlayer.status.metallicize;
    }

    let newEnemies = state.enemies.map(e => {
      if (e.hp <= 0) return e;

      let updatedEnemy = { ...e, block: 0 };
      const def = ENEMY_DEFS[e.defId];

      switch (e.intent.type) {
        case 'attack': {
          const baseDmg = e.intent.value || 6;
          const hits = e.intent.hits || 1;
          for (let h = 0; h < hits; h++) {
            const dmg = calcDamage(baseDmg, updatedEnemy.status, newPlayer.status);
            const result = applyDamageToTarget(newPlayer.hp, newPlayer.block, dmg);
            newPlayer.hp = result.hp;
            newPlayer.block = result.block;

            // Thorns
            if (newPlayer.status.thorns > 0) {
              const thornDmg = newPlayer.status.thorns;
              const thornResult = applyDamageToTarget(updatedEnemy.hp, updatedEnemy.block, thornDmg);
              updatedEnemy.hp = thornResult.hp;
              updatedEnemy.block = thornResult.block;
            }
          }
          break;
        }
        case 'defend':
          updatedEnemy.block += e.intent.value || 6;
          break;
        case 'buff':
          updatedEnemy.status = {
            ...updatedEnemy.status,
            strength: updatedEnemy.status.strength + 3,
          };
          break;
        case 'debuff':
          newPlayer.status = {
            ...newPlayer.status,
            weak: newPlayer.status.weak + 2,
            vulnerable: newPlayer.status.vulnerable + 1,
          };
          break;
        case 'attack_defend': {
          const dmg = calcDamage(e.intent.value || 6, updatedEnemy.status, newPlayer.status);
          const result = applyDamageToTarget(newPlayer.hp, newPlayer.block, dmg);
          newPlayer.hp = result.hp;
          newPlayer.block = result.block;
          updatedEnemy.block += 6;
          break;
        }
      }

      // On turn end effects
      if (def.onTurnEnd) {
        const updates = def.onTurnEnd(updatedEnemy);
        updatedEnemy = { ...updatedEnemy, ...updates };
      }

      // Advance turn and compute next intent
      updatedEnemy.turnCounter++;
      updatedEnemy.status = decrementStatus(updatedEnemy.status);
      updatedEnemy.intent = def.getIntent(updatedEnemy.turnCounter, updatedEnemy);

      return updatedEnemy;
    });

    // Decrement player status effects
    newPlayer.status = decrementStatus(newPlayer.status);

    set({ player: newPlayer, enemies: newEnemies });

    // Check player death
    if (newPlayer.hp <= 0) {
      setTimeout(() => set({ phase: 'game_over' }), 500);
      return;
    }

    // Start new player turn
    setTimeout(() => {
      const s = get();
      set({
        turn: s.turn + 1,
        isEnemyTurn: false,
        player: { ...s.player, block: 0, energy: s.player.maxEnergy },
      });

      get().drawCards(5);
    }, 400);
  },

  selectCard: (cardUid) => set({ selectedCardUid: cardUid }),

  addRewardCard: (defId) => {
    const state = get();
    const newCard: CardInstance = { uid: uid(), defId, upgraded: false };
    set({
      deck: [...state.deck, newCard],
      phase: 'map',
    });
  },

  skipReward: () => set({ phase: 'map' }),

  rest: () => {
    set(s => ({
      player: {
        ...s.player,
        hp: Math.min(s.player.maxHp, Math.floor(s.player.hp + s.player.maxHp * 0.3)),
      },
      phase: 'map',
    }));
  },

  upgradeCard: (cardUid) => {
    set(s => ({
      deck: s.deck.map(c => c.uid === cardUid ? { ...c, upgraded: true } : c),
      phase: 'map',
    }));
  },

  addFloatingText: (text, x, y, color) => {
    const id = uid();
    set(s => ({
      floatingTexts: [...s.floatingTexts, { id, text, x, y, color, life: 1.5 }],
    }));
  },

  tick: (dt) => {
    set(s => ({
      floatingTexts: s.floatingTexts
        .map(f => ({ ...f, life: f.life - dt, y: f.y - dt * 30 }))
        .filter(f => f.life > 0),
      screenShake: Math.max(0, s.screenShake - dt * 5),
    }));
  },

  returnToMainMenu: () => {
    set({
      phase: 'main_menu',
      previousPhase: null,
    });
  },

  applyEventOutcome: (outcome) => {
    set(s => {
      let player = { ...s.player };
      let deck = [...s.deck];

      if (outcome.hp) {
        player.hp = Math.max(1, Math.min(player.maxHp, player.hp + outcome.hp));
      }
      if (outcome.maxHp) {
        player.maxHp += outcome.maxHp;
        player.hp += outcome.maxHp;
      }
      if (outcome.gold) {
        player.gold = Math.max(0, player.gold + outcome.gold);
      }
      if (outcome.upgradeRandom) {
        const upgradable = deck.filter(c => !c.upgraded);
        if (upgradable.length > 0) {
          const target = upgradable[Math.floor(Math.random() * upgradable.length)];
          deck = deck.map(c => c.uid === target.uid ? { ...c, upgraded: true } : c);
        }
      }

      return { player, deck };
    });
  },
}));
