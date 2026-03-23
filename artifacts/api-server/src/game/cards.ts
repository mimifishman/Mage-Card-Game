import type { Card, CardId, Rank, Suit } from "./types";

const SUITS: Suit[] = ["H", "S", "D", "C"];
const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const ROYAL_RANKS: Rank[] = ["J", "Q", "K"];

function pipValue(rank: Rank | "JOKER"): number {
  if (rank === "JOKER") return 0;
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return parseInt(rank, 10);
}

function vaultCost(
  rank: Rank | "JOKER",
  suit: Suit | "JOKER",
  isRoyal: boolean,
): number {
  if (suit === "JOKER" || rank === "JOKER") return 10;
  if (isRoyal) return 0;
  if (suit === "D") return 0;
  return pipValue(rank);
}

function buildCard(rank: Rank, suit: Suit): Card {
  const id = `${rank}${suit}`;
  const isRoyal = ROYAL_RANKS.includes(rank);
  const isJoker = false;
  const pv = pipValue(rank);
  return {
    id,
    suit,
    rank,
    isRoyal,
    isJoker,
    pipValue: pv,
    vaultCost: vaultCost(rank, suit, isRoyal),
  };
}

const _cardMap = new Map<CardId, Card>();

function buildCardMap(): Map<CardId, Card> {
  if (_cardMap.size > 0) return _cardMap;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const card = buildCard(rank, suit);
      _cardMap.set(card.id, card);
    }
  }
  const joker1: Card = {
    id: "JOKER1",
    suit: "JOKER",
    rank: "JOKER",
    isRoyal: false,
    isJoker: true,
    pipValue: 0,
    vaultCost: 10,
  };
  const joker2: Card = {
    id: "JOKER2",
    suit: "JOKER",
    rank: "JOKER",
    isRoyal: false,
    isJoker: true,
    pipValue: 0,
    vaultCost: 10,
  };
  _cardMap.set("JOKER1", joker1);
  _cardMap.set("JOKER2", joker2);
  return _cardMap;
}

export function getCard(cardId: CardId): Card {
  const map = buildCardMap();
  const card = map.get(cardId);
  if (!card) throw new Error(`Unknown card id: ${cardId}`);
  return card;
}

export function fullDeck(): CardId[] {
  const map = buildCardMap();
  return [...map.keys()];
}

export function shuffle(cards: CardId[]): CardId[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function royalBaseAttack(rank: Rank): number {
  if (rank === "J") return 2;
  if (rank === "Q") return 3;
  return 4;
}

export function royalBaseHealth(rank: Rank): number {
  if (rank === "J") return 3;
  if (rank === "Q") return 4;
  return 5;
}

export function royalSupportBuff(rank: Rank): { attack: number; health: number } {
  if (rank === "J") return { attack: 1, health: 2 };
  if (rank === "Q") return { attack: 2, health: 3 };
  return { attack: 3, health: 4 };
}

export function effectiveAttack(royal: {
  cardId: CardId;
  buffAttack: number;
}): number {
  const card = getCard(royal.cardId);
  if (!card.isRoyal) return 0;
  return royalBaseAttack(card.rank as Rank) + royal.buffAttack;
}

export function effectiveHealth(royal: {
  cardId: CardId;
  buffHealth: number;
  damageTaken: number;
}): number {
  const card = getCard(royal.cardId);
  if (!card.isRoyal) return 0;
  return royalBaseHealth(card.rank as Rank) + royal.buffHealth - royal.damageTaken;
}
