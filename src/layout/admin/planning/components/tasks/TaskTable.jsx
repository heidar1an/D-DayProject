/*
 * جدول مدیریتی تسک‌ها.
 *
 * برای دادهٔ زیاد ساخته شده: سرستون‌ها قابل مرتب‌سازی، ردیف‌ها فشرده و ستون
 * عملیات چسبیده به انتهای ردیف. سرستون‌های چسبان در CSS با `position: sticky`
 * می‌آیند تا در جدول‌های بلند، عنوان ستون‌ها از دست نرود.
 */

import { IconEdit, IconEye, IconSend, IconTrash } from '../../../adminIcons';
import { PRIORITIES, TASK_STATUSES, labelOf, toneOf } from '../../../../../services/planning/planningTypes';
import { isoDate, jalaliLabel, toFa } from '../../../../../services/planning/jalali';
import { Meter, Pill, Tip } from '../../planningKit';

const COLUMNS = [
  { key: 'code', label: 'کد', sortable: true },
  { key: 'title', label: 'عنوان تسک', sortable: true },
  { key: 'project', label: 'پروژه' },
  { key: 'owner', label: 'مسئول', sortable: true },
  { key: 'dueDate', label: 'سررسید', sortable: true },
  { key: 'priority', label: 'اولویت', sortable: true },
  { key: 'status', label: 'وضعیت', sortable: true },
  { key: 'progress', label: 'پیشرفت', sortable: true },
  { key: 'actions', label: 'عملیات' },
];

export default function TaskTable({
  tasks, projects = [], users = [], sort, onSort, onOpen, onEdit, onAssign, onDelete,
}) {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const todayIso = isoDate(new Date());

  return (
    <div className="pl-tablewrap">
      <table className="pl-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col">
                {column.sortable ? (
                  <button
                    type="button"
                    className={`pl-table__sort ${sort === column.key ? 'is-active' : ''}`}
                    onClick={() => onSort?.(column.key)}
                  >
                    {column.label}
                    {sort === column.key ? <span aria-hidden="true">▾</span> : null}
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const owner = userMap.get(task.ownerId);
            const project = projectMap.get(task.projectId);
            const overdue = task.dueDate < todayIso && !['done', 'canceled'].includes(task.status);

            return (
              <tr key={task.id} className={overdue ? 'is-overdue' : ''}>
                <td><code className="pl-mono">{task.code}</code></td>

                <td className="pl-table__wide">
                  <button type="button" className="pl-link" onClick={() => onOpen(task)}>{task.title}</button>
                  {task.tags?.length ? (
                    <span className="pl-tagrow">
                      {task.tags.map((tag) => <span key={tag} className="pl-tag">{tag}</span>)}
                    </span>
                  ) : null}
                </td>

                <td>{project?.title ?? '—'}</td>

                <td>
                  {owner ? (
                    <span className="pl-celluser">
                      <span className="pl-avatar pl-avatar--sm">{owner.avatar}</span>
                      {owner.name}
                    </span>
                  ) : '—'}
                </td>

                <td className={overdue ? 'is-danger' : ''}>
                  {jalaliLabel(task.dueDate, { short: true })}
                  {overdue ? <span className="pl-table__flag">عقب‌افتاده</span> : null}
                </td>

                <td><Pill tone={toneOf(PRIORITIES, task.priority)}>{labelOf(PRIORITIES, task.priority)}</Pill></td>

                <td><Pill tone={toneOf(TASK_STATUSES, task.status)}>{labelOf(TASK_STATUSES, task.status)}</Pill></td>

                <td className="pl-table__progress">
                  <Meter value={task.progress} tone={task.status === 'done' ? 'green' : 'accent'} compact showValue={false} />
                  <b>{toFa(task.progress)}٪</b>
                </td>

                <td>
                  <div className="pl-rowactions">
                    <Tip text="جزئیات">
                      <button type="button" className="pl-iconbtn pl-iconbtn--sm" onClick={() => onOpen(task)} aria-label="جزئیات تسک">
                        <IconEye width={14} height={14} />
                      </button>
                    </Tip>
                    <Tip text="ویرایش">
                      <button type="button" className="pl-iconbtn pl-iconbtn--sm" onClick={() => onEdit(task)} aria-label="ویرایش تسک">
                        <IconEdit width={14} height={14} />
                      </button>
                    </Tip>
                    <Tip text="ابلاغ">
                      <button type="button" className="pl-iconbtn pl-iconbtn--sm" onClick={() => onAssign(task)} aria-label="ابلاغ تسک">
                        <IconSend width={14} height={14} />
                      </button>
                    </Tip>
                    <Tip text="حذف">
                      <button type="button" className="pl-iconbtn pl-iconbtn--sm pl-iconbtn--danger" onClick={() => onDelete(task)} aria-label="حذف تسک">
                        <IconTrash width={14} height={14} />
                      </button>
                    </Tip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
