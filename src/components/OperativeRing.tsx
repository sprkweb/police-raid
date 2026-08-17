import React from 'react';
import type { PlayerId } from '../types/game';

export type SeatAccent = 'me' | 'mole' | 'team' | 'lead' | 'reveal-police' | 'reveal-mole';
export type SeatGlyph = 'signed' | 'approve' | 'reject';

export interface SeatView {
  id: PlayerId;
  name: string;
  flag?: string;
  accent?: SeatAccent;
  glyph?: SeatGlyph;
  dimmed: boolean;
  offline?: boolean;
  /** Цвет иконки по роли, если зрителю она известна (своя / кроту / конец игры). */
  iconTone?: 'police' | 'mole';
}

interface Props {
  seats: SeatView[];
  onSelect?: (id: PlayerId) => void;
  children: React.ReactNode;
}

const SEAT_RADIUS = 38;

const angleOf = (index: number, total: number) => (-90 + (360 / total) * index) * Math.PI / 180;

const glyphLabel: Record<SeatGlyph, string> = {
  signed: 'signed',
  approve: 'approved',
  reject: 'rejected',
};

const seatClassName = (seat: SeatView, selectable: boolean) => {
  const classes = ['pr-seat'];
  if (seat.accent) classes.push(`pr-accent-${seat.accent}`);
  if (seat.glyph) classes.push(`pr-glyph-${seat.glyph}`);
  else if (seat.iconTone) classes.push(seat.iconTone === 'mole' ? 'pr-icon-mole' : 'pr-icon-police');
  if (seat.dimmed) classes.push('pr-dim');
  if (seat.offline) classes.push('pr-offline');
  if (seat.flag) classes.push('pr-has-flag');
  if (selectable) classes.push('pr-selectable');
  return classes.join(' ');
};

export const OperativeRing: React.FC<Props> = ({ seats, onSelect, children }) => (
  <div className="pr-ring">
    <div className="pr-ring-outer" />
    <div className="pr-ring-inner" />
    <div className="pr-ring-cross" />

    {seats.map((seat, i) => {
      const a = angleOf(i, seats.length);
      return (
        <button
          key={seat.id}
          type="button"
          className={seatClassName(seat, Boolean(onSelect))}
          style={{
            left: `${50 + SEAT_RADIUS * Math.cos(a)}%`,
            top: `${50 + SEAT_RADIUS * Math.sin(a)}%`,
          }}
          onClick={onSelect ? () => onSelect(seat.id) : undefined}
          disabled={!onSelect}
          aria-label={seat.glyph ? `${seat.name}, ${glyphLabel[seat.glyph]}` : undefined}
        >
          {seat.flag && <span className="pr-seat-flag">{seat.flag}</span>}
          <span className="pr-seat-ava" aria-hidden="true">
            <span className="pr-seat-ico" />
          </span>
          <span className="pr-seat-nm">{seat.name}</span>
          <span className="pr-seat-bd">#{seat.id.slice(-4).toUpperCase()}</span>
        </button>
      );
    })}

    <div className="pr-console">
      <div>{children}</div>
    </div>
  </div>
);
