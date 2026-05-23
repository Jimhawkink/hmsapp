import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';
import { logAudit } from '../services/auditService';

// ─── Expenses CRUD ────────────────────────────────────────────────────────────
export const getExpenses = async (req: Request, res: Response) => {
  try {
    const { from, to, category } = req.query;
    let sql = `SELECT * FROM expenses WHERE 1=1`;
    const bind: any[] = [];
    let idx = 1;

    if (from) { sql += ` AND expense_date >= $${idx++}`; bind.push(from); }
    if (to) { sql += ` AND expense_date <= $${idx++}`; bind.push(to); }
    if (category && category !== 'all') { sql += ` AND category = $${idx++}`; bind.push(category); }

    sql += ` ORDER BY expense_date DESC, created_at DESC`;

    const rows = await sequelize.query(sql, { bind, type: QueryTypes.SELECT });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const { expense_name, expense_type, amount, description, expense_date, category, payment_mode, reference_no } = req.body;
    if (!expense_name || !amount) return res.status(400).json({ message: 'expense_name and amount required' });

    const [saved]: any = await sequelize.query(
      `INSERT INTO expenses (expense_name, expense_type, amount, description, expense_date, category, payment_mode, reference_no, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      { bind: [expense_name, expense_type || category || 'Other', amount, description || null,
               expense_date || new Date().toISOString().split('T')[0], category || 'Other',
               payment_mode || 'Cash', reference_no || null, (req as any).user?.name || 'System'],
        type: QueryTypes.SELECT }
    );

    await logAudit('CREATE', 'expenses', saved.expense_id, (req as any).user || {}, null, saved);
    res.status(201).json(saved);
  } catch (err) {
    console.error('createExpense error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { expense_name, amount, description, expense_date, category, payment_mode, reference_no } = req.body;

    const [old]: any = await sequelize.query('SELECT * FROM expenses WHERE expense_id = $1', { bind: [id], type: QueryTypes.SELECT });
    if (!old) return res.status(404).json({ message: 'Expense not found' });

    await sequelize.query(
      `UPDATE expenses SET expense_name=$1, amount=$2, description=$3, expense_date=$4,
       category=$5, payment_mode=$6, reference_no=$7 WHERE expense_id=$8`,
      { bind: [expense_name || old.expense_name, amount || old.amount, description || old.description,
               expense_date || old.expense_date, category || old.category,
               payment_mode || old.payment_mode, reference_no || old.reference_no, id] }
    );

    await logAudit('UPDATE', 'expenses', id, (req as any).user || {}, old, req.body);
    res.json({ message: 'Expense updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [old]: any = await sequelize.query('SELECT * FROM expenses WHERE expense_id = $1', { bind: [id], type: QueryTypes.SELECT });
    if (!old) return res.status(404).json({ message: 'Expense not found' });

    await sequelize.query('DELETE FROM expenses WHERE expense_id = $1', { bind: [id] });
    await logAudit('DELETE', 'expenses', id, (req as any).user || {}, old, null);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getExpenseSummary = async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || new Date().toISOString().slice(0, 7); // YYYY-MM

    const [byCategory, monthlyTrend, budgets] = await Promise.all([
      sequelize.query(
        `SELECT category, SUM(amount) AS total FROM expenses
         WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1
         GROUP BY category ORDER BY total DESC`,
        { bind: [period], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month, SUM(amount) AS total
         FROM expenses
         WHERE expense_date >= NOW() - INTERVAL '12 months'
         GROUP BY month ORDER BY month`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT b.category, b.budget_amount,
                COALESCE(e.actual, 0) AS actual_amount,
                b.budget_amount - COALESCE(e.actual, 0) AS variance
         FROM hms_budget b
         LEFT JOIN (
           SELECT category, SUM(amount) AS actual
           FROM expenses
           WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1
           GROUP BY category
         ) e ON b.category = e.category
         WHERE b.period = $1`,
        { bind: [period], type: QueryTypes.SELECT }
      ),
    ]);

    res.json({ period, byCategory, monthlyTrend, budgets });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Budget ───────────────────────────────────────────────────────────────────
export const getBudgets = async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string || new Date().toISOString().slice(0, 7);
    const rows = await sequelize.query(
      'SELECT * FROM hms_budget WHERE period = $1 ORDER BY category',
      { bind: [period], type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const setBudget = async (req: Request, res: Response) => {
  try {
    const { category, period, budget_amount } = req.body;
    if (!category || !period || budget_amount === undefined) return res.status(400).json({ message: 'category, period, budget_amount required' });

    await sequelize.query(
      `INSERT INTO hms_budget (category, period, budget_amount)
       VALUES ($1,$2,$3)
       ON CONFLICT (category, period) DO UPDATE SET budget_amount=$3, updated_at=NOW()`,
      { bind: [category, period, budget_amount] }
    );
    res.json({ message: 'Budget set' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
