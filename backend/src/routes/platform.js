import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { asyncHandler, loadUser, requireAuth, requireRole } from '../middleware.js';
const router = Router();
router.use(loadUser);
const id = z.coerce.number().int().positive();
const body = (schema, req, res) => { const result = schema.safeParse(req.body); if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return null; } return result.data; };

router.get('/lesson-types', asyncHandler(async (req, res) => res.json((await pool.query('SELECT * FROM lesson_types WHERE active=true ORDER BY name')).rows)));
router.get('/instructors', asyncHandler(async (req, res) => res.json((await pool.query(`SELECT u.id,u.display_name,p.bio,p.license_number FROM instructor_profiles p JOIN users u ON u.id=p.user_id WHERE p.active=true ORDER BY u.display_name`)).rows)));
router.get('/instructors/:instructorId/availability', asyncHandler(async (req, res) => {
  const parsed = id.safeParse(req.params.instructorId); if (!parsed.success) return res.status(400).json({ error: 'Invalid instructor id' });
  res.json((await pool.query('SELECT * FROM instructor_availability WHERE instructor_id=$1 AND available=true ORDER BY weekday,start_time', [parsed.data])).rows);
}));
router.get('/notifications', requireAuth, asyncHandler(async (req, res) => res.json((await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id])).rows)));
router.post('/instructor/messages', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({
    student_id: z.number().int().positive(),
    message: z.string().trim().min(1).max(2000),
  }), req, res); if (!data) return;
  const student = (await pool.query(
    `SELECT u.id, u.display_name
     FROM users u
     WHERE u.id=$1 AND EXISTS (
       SELECT 1 FROM bookings b WHERE b.student_id=u.id AND b.instructor_id=$2
     )`,
    [data.student_id, req.user.id],
  )).rows[0];
  if (!student) return res.status(404).json({ error: 'Student not found in your lessons.' });
  const { rows } = await pool.query(
    `INSERT INTO notifications(user_id,title,message) VALUES($1,$2,$3) RETURNING id,title,message,created_at`,
    [student.id, `Message from ${req.user.display_name}`, data.message],
  );
  res.status(201).json(rows[0]);
}));
router.get('/instructor/overview', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const profile = (await pool.query(
    `SELECT u.display_name, u.contact, ip.phone, ip.bio, ip.license_number, ip.active
     FROM users u LEFT JOIN instructor_profiles ip ON ip.user_id=u.id WHERE u.id=$1`,
    [req.user.id],
  )).rows[0];
  const bookings = (await pool.query(
    `SELECT b.id, b.starts_at, b.ends_at, b.status, b.notes, b.created_at,
      lt.name lesson_type, lt.duration_minutes, lt.price_cents,
      s.id student_id, s.display_name student_name, s.contact student_contact
     FROM bookings b
     JOIN lesson_types lt ON lt.id=b.lesson_type_id
     JOIN users s ON s.id=b.student_id
     WHERE b.instructor_id=$1 ORDER BY b.starts_at`,
    [req.user.id],
  )).rows;
  const availability = (await pool.query(
    'SELECT id, weekday, start_time, end_time, available FROM instructor_availability WHERE instructor_id=$1 ORDER BY weekday,start_time',
    [req.user.id],
  )).rows;
  const blocks = (await pool.query(
    'SELECT id, starts_at, ends_at, reason FROM instructor_blocks WHERE instructor_id=$1 AND ends_at >= NOW() ORDER BY starts_at',
    [req.user.id],
  )).rows;
  res.json({
    profile,
    bookings,
    availability,
    blocks,
    stats: {
      upcomingLessons: bookings.filter((booking) => ['pending', 'confirmed'].includes(booking.status)).length,
      completedLessons: bookings.filter((booking) => booking.status === 'completed').length,
      activeStudents: new Set(bookings.map((booking) => booking.student_id)).size,
    },
  });
}));
router.get('/student/overview', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  await pool.query(
    `INSERT INTO student_profiles(user_id) VALUES($1)
     ON CONFLICT(user_id) DO NOTHING`,
    [req.user.id],
  );
  await pool.query(
    `INSERT INTO bookings(student_id, instructor_id, lesson_type_id, starts_at, ends_at, status, notes)
     SELECT $1, instructor.id, lesson.id, NOW() + INTERVAL '2 days',
       NOW() + INTERVAL '2 days 1 hour', 'confirmed', 'Your first Crelo lesson'
     FROM users instructor
     CROSS JOIN lesson_types lesson
     WHERE instructor.contact='demo.instructor@roadready.local'
       AND lesson.name='Behind-the-wheel'
       AND NOT EXISTS (SELECT 1 FROM bookings WHERE student_id=$1)`,
    [req.user.id],
  );
  const profile = (await pool.query(
    'SELECT * FROM student_profiles WHERE user_id=$1',
    [req.user.id],
  )).rows[0];
  const bookings = (await pool.query(
    `SELECT b.*, lt.name lesson_type, lt.duration_minutes, lt.price_cents,
      u.display_name instructor_name, ip.bio instructor_bio
     FROM bookings b
     JOIN lesson_types lt ON lt.id=b.lesson_type_id
     JOIN users u ON u.id=b.instructor_id
     LEFT JOIN instructor_profiles ip ON ip.user_id=b.instructor_id
     WHERE b.student_id=$1
     ORDER BY b.starts_at`,
    [req.user.id],
  )).rows;
  const payments = (await pool.query(
    `SELECT id, amount_cents, status, provider_reference, created_at
     FROM payments WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user.id],
  )).rows;
  const notifications = (await pool.query(
    `SELECT id, title, message, read_at, created_at
     FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10`,
    [req.user.id],
  )).rows;
  const completedLessons = bookings.filter((booking) => booking.status === 'completed').length;
  const nextLesson = bookings.find((booking) => ['pending', 'confirmed'].includes(booking.status));
  res.json({
    profile,
    bookings,
    nextLesson,
    payments,
    notifications,
    progress: {
      completedLessons,
      overallPercent: Math.min(100, completedLessons * 10),
    },
  });
}));
router.post('/admin/lesson-types', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({ name: z.string().min(2).max(100), description: z.string().max(500).optional(), duration_minutes: z.number().int().positive(), price_cents: z.number().int().nonnegative() }), req, res); if (!data) return;
  const { rows } = await pool.query('INSERT INTO lesson_types(name,description,duration_minutes,price_cents) VALUES($1,$2,$3,$4) RETURNING *', [data.name, data.description, data.duration_minutes, data.price_cents]); res.status(201).json(rows[0]);
}));
router.post('/instructor/availability', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({ weekday: z.number().int().min(0).max(6), start_time: z.string(), end_time: z.string() }), req, res); if (!data) return;
  const { rows } = await pool.query('INSERT INTO instructor_availability(instructor_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4) RETURNING *', [req.user.id,data.weekday,data.start_time,data.end_time]); res.status(201).json(rows[0]);
}));
router.post('/instructor/blocks', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    reason: z.string().trim().max(200).optional(),
  }), req, res); if (!data) return;
  if (new Date(data.ends_at) <= new Date(data.starts_at)) return res.status(400).json({ error: 'End time must be after start time' });
  const { rows } = await pool.query(
    'INSERT INTO instructor_blocks(instructor_id,starts_at,ends_at,reason) VALUES($1,$2,$3,$4) RETURNING id,starts_at,ends_at,reason',
    [req.user.id, data.starts_at, data.ends_at, data.reason || null],
  );
  res.status(201).json(rows[0]);
}));
router.delete('/instructor/blocks/:blockId', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const parsed = id.safeParse(req.params.blockId); if (!parsed.success) return res.status(400).json({ error: 'Invalid block id' });
  const result = await pool.query('DELETE FROM instructor_blocks WHERE id=$1 AND instructor_id=$2', [parsed.data, req.user.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Blocked period not found' });
  res.status(204).end();
}));
router.patch('/instructor/profile', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({
    display_name: z.string().trim().min(2).max(100),
    contact: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).optional(),
    bio: z.string().trim().max(2000).optional(),
    license_number: z.string().trim().max(100).optional(),
  }), req, res); if (!data) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET display_name=$1, contact=$2 WHERE id=$3', [data.display_name, data.contact.toLowerCase(), req.user.id]);
    const { rows } = await client.query(
      `INSERT INTO instructor_profiles(user_id,phone,bio,license_number) VALUES($1,$2,$3,$4)
       ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,bio=EXCLUDED.bio,license_number=EXCLUDED.license_number
       RETURNING *`,
      [req.user.id, data.phone || null, data.bio || null, data.license_number || null],
    );
    await client.query('COMMIT');
    res.json({ ...rows[0], display_name: data.display_name, contact: data.contact.toLowerCase() });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));
router.patch('/profiles/student', requireAuth, asyncHandler(async (req, res) => {
  const data = body(z.object({ phone: z.string().max(30).optional(), address: z.string().max(255).optional(), emergency_contact: z.string().max(100).optional() }), req, res); if (!data) return;
  const { rows } = await pool.query(`INSERT INTO student_profiles(user_id,phone,address,emergency_contact) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,address=EXCLUDED.address,emergency_contact=EXCLUDED.emergency_contact RETURNING *`, [req.user.id,data.phone,data.address,data.emergency_contact]); res.json(rows[0]);
}));
router.post('/bookings', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const data = body(z.object({ instructor_id: z.number().int().positive(), lesson_type_id: z.number().int().positive(), starts_at: z.string().datetime(), ends_at: z.string().datetime(), notes: z.string().max(1000).optional() }), req, res); if (!data) return;
  const blocked = await pool.query('SELECT 1 FROM instructor_blocks WHERE instructor_id=$1 AND starts_at < $3 AND ends_at > $2 LIMIT 1', [data.instructor_id, data.starts_at, data.ends_at]);
  if (blocked.rowCount) return res.status(409).json({ error: 'This instructor is unavailable during that time.' });
  const { rows } = await pool.query(`INSERT INTO bookings(student_id,instructor_id,lesson_type_id,starts_at,ends_at,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [req.user.id,data.instructor_id,data.lesson_type_id,data.starts_at,data.ends_at,data.notes]); res.status(201).json(rows[0]);
}));
router.get('/bookings', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT b.*,lt.name lesson_type,u.display_name instructor_name FROM bookings b JOIN lesson_types lt ON lt.id=b.lesson_type_id JOIN users u ON u.id=b.instructor_id WHERE b.student_id=$1 OR b.instructor_id=$1 ORDER BY b.starts_at`, [req.user.id]); res.json(rows);
}));
router.patch('/bookings/:bookingId/status', requireAuth, requireRole('student','instructor','admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({ status: z.enum(['confirmed','cancelled','completed']) }), req, res); if (!data) return;
  const parsed=id.safeParse(req.params.bookingId); if (!parsed.success) return res.status(400).json({ error:'Invalid booking id' });
  const { rows } = await pool.query(`UPDATE bookings SET status=$1,updated_at=NOW() WHERE id=$2 AND (student_id=$3 OR instructor_id=$3) RETURNING *`, [data.status,parsed.data,req.user.id]); if (!rows[0]) return res.status(404).json({ error:'Booking not found' }); res.json(rows[0]);
}));
router.patch('/bookings/:bookingId/schedule', requireAuth, requireRole('student','instructor','admin'), asyncHandler(async (req, res) => {
  const data = body(z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
  }), req, res);
  if (!data) return;
  const parsed = id.safeParse(req.params.bookingId);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid booking id' });
  if (new Date(data.ends_at) <= new Date(data.starts_at)) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }
  const booking = (await pool.query('SELECT instructor_id FROM bookings WHERE id=$1 AND (student_id=$2 OR instructor_id=$2)', [parsed.data, req.user.id])).rows[0];
  if (!booking) return res.status(404).json({ error: 'Bookable lesson not found' });
  const blocked = await pool.query('SELECT 1 FROM instructor_blocks WHERE instructor_id=$1 AND starts_at < $3 AND ends_at > $2 LIMIT 1', [booking.instructor_id, data.starts_at, data.ends_at]);
  if (blocked.rowCount) return res.status(409).json({ error: 'This instructor is unavailable during that time.' });
  const { rows } = await pool.query(
    `UPDATE bookings
     SET starts_at=$1, ends_at=$2,
       status=CASE WHEN $5 THEN 'pending' ELSE status END,
       updated_at=NOW()
     WHERE id=$3 AND (student_id=$4 OR instructor_id=$4) AND status NOT IN ('cancelled','completed')
     RETURNING *`,
    [data.starts_at, data.ends_at, parsed.data, req.user.id, req.user.roles.includes('student')],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Bookable lesson not found' });
  res.json(rows[0]);
}));
export { router as platformRouter };
