import React from 'react';
import type { PlayerId } from '../types/game';

export interface SeatView {
  id: PlayerId;
  name: string;
  initials: string;
  flag?: string;
  isMe: boolean;
  onTeam: boolean;
  isLead: boolean;
  isAlly: boolean;
  dimmed: boolean;
  reveal?: 'police' | 'mole';
  mark?: 'done' | 'waiting';
}

interface Props {
  seats: SeatView[];
  onSelect?: (id: PlayerId) => void;
  children: React.ReactNode;
}

const SEAT_RADIUS = 38;

const angleOf = (index: number, total: number) => (-90 + (360 / total) * index) * Math.PI / 180;

const seatClassName = (seat: SeatView, selectable: boolean) => {
  const classes = ['pr-seat'];
  if (seat.reveal) classes.push(seat.reveal === 'mole' ? 'pr-reveal-mole' : 'pr-reveal-police');
  if (seat.onTeam) classes.push('pr-on-team');
  if (seat.isAlly) classes.push('pr-ally');
  if (seat.isMe) classes.push('pr-me');
  if (seat.isLead) classes.push('pr-lead');
  if (seat.dimmed) classes.push('pr-dim');
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
        >
          {seat.flag && <span className="pr-seat-flag">{seat.flag}</span>}
          <span className="pr-seat-ava">{seat.initials}</span>
          <span className="pr-seat-nm">{seat.name}</span>
          <span className="pr-seat-bd">#{seat.id.slice(-4).toUpperCase()}</span>
          {seat.mark && (
            <span className={`pr-seat-mark pr-${seat.mark}`}>{seat.mark === 'done' ? '✓' : '·'}</span>
          )}
        </button>
      );
    })}

    <div className="pr-console">
      <div>{children}</div>
    </div>
  </div>
);
