import { formatQuantity } from '../modules/unit-conversion.js';
import { UNIT_LABELS } from '../labels.js';
export const fmt = (q, u) => { const f = formatQuantity(q, u); return `${f.quantity} ${UNIT_LABELS[f.unit] ?? f.unit}`; };
