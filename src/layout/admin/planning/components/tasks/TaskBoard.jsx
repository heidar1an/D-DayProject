/*
 * برد کانبان تسک‌ها.
 *
 * ستون‌ها از وضعیت‌های تسک ساخته می‌شوند (به‌جز «لغوشده» که ستون نمی‌گیرد).
 * کشیدن کارت به ستون دیگر، وضعیت را عوض می‌کند؛ «تکمیل‌شده» پیشرفت را هم ۱۰۰
 * می‌کند و این منطق در سرویس است، نه اینجا.
 */

import { useMemo, useState } from 'react';

import { IconClock, IconEdit, IconPaperclip } from '../../../adminIcons';
import { KANBAN_STATUSES, PRIORITIES, labelOf } from '../../../../../services/planning/planningTypes';
import { isoDate, jalaliLabel, toFa } from '../../../../../services/planning/jalali';
import { Dot, Meter, Pill, Tip } from '../../planningKit';

function BoardCard({ task, owner, project, onOpen, onEdit }) {
  const overdue = task.dueDate < isoDate(new Date()) && !['done', 'canceled'].includes(task.status);

  return (
    <article
      className={`pl-card pl-card--${task.priority}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      <header className="pl-card__head">
        <code className="pl-mono">{task.code}</code>
        <div className="pl-card__actions">
          <Tip text="ویرایش">
            <button type="button" className="pl-iconbtn pl-iconbtn--sm" onClick={() => onEdit(task)} aria-label="ویرایش تسک">
              <IconEdit width={13} height={13} />
            </button>
          </Tip>
        </div>
      </header>

      <button type="button" className="pl-card__title" onClick={() => onOpen(task)}>{task.title}</button>

      <div className="pl-card__meta">
        <Pill tone={PRIORITIES.find((item) => item.value === task.priority)?.tone ?? 'neutral'}>
          {labelOf(PRIORITIES, task.priority)}
        </Pill>
        {project ? <span className="pl-muted">{project.title}</span> : null}
      </div>

      <Meter value={task.progress} tone={task.status === 'done' ? 'green' : 'accent'} compact />

      <footer className="pl-card__foot">
        <span className={`pl-card__due ${overdue ? 'is-overdue' : ''}`}>
          <IconClock width={13} height={13} />
          {jalaliLabel(task.dueDate, { short: true })}
        </span>
        <span className="pl-card__right">
          {task.attachments?.length ? (
            <span className="pl-muted"><IconPaperclip width={12} height={12} /> {toFa(task.attachments.length)}</span>
          ) : null}
          {owner ? <span className="pl-avatar pl-avatar--sm" title={owner.name}>{owner.avatar}</span> : null}
        </span>
      </footer>
    </article>
  );
}

export default function TaskBoard({ tasks, projects = [], users = [], onOpen, onEdit, onStatusChange }) {
  const [dragOver, setDragOver] = useState('');

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const columns = useMemo(
    () => KANBAN_STATUSES.map((status) => ({
      ...status,
      items: tasks.filter((task) => task.status === status.value),
    })),
    [tasks],
  );

  const handleDrop = (status, event) => {
    event.preventDefault();
    setDragOver('');
    const id = event.dataTransfer.getData('text/plain');
    if (id) onStatusChange?.(id, status);
  };

  return (
    <div className="pl-board">
      {columns.map((column) => (
        <section
          key={column.value}
          className={`pl-board__col ${dragOver === column.value ? 'is-drop' : ''}`.trim()}
          onDragOver={(event) => { event.preventDefault(); setDragOver(column.value); }}
          onDragLeave={() => setDragOver((current) => (current === column.value ? '' : current))}
          onDrop={(event) => handleDrop(column.value, event)}
        >
          <header className="pl-board__head">
            <Dot tone={column.color} />
            <strong>{column.label}</strong>
            <span className="pl-badge-count">{toFa(column.items.length)}</span>
          </header>

          <div className="pl-board__body">
            {column.items.length === 0 ? (
              <p className="pl-board__empty">کارتی در این ستون نیست</p>
            ) : column.items.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                owner={userMap.get(task.ownerId)}
                project={projectMap.get(task.projectId)}
                onOpen={onOpen}
                onEdit={onEdit}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
