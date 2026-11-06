import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { asyncHandler, loadUser, requireAuth, requireRole } from '../middleware.js';
const router = Router();
router.use(loadUser);
const id = z.coerce.number().int().positive();
const body = (schema, req, res) => { const result = schema.safeParse(req.body); if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return null; } return result.data; };

router.get('/lesson-types', asyncHandler(async (req, res) => res.json((await pool.query('SELECT * FROM lesson_types WHERE active=true ORDER BY duration_minutes DESC,name')).rows)));
router.get('/instructors', asyncHandler(async (req, res) => res.json((await pool.query(`SELECT u.id,u.display_name,p.bio,p.license_number FROM instructor_profiles p JOIN users u ON u.id=p.user_id WHERE p.active=true AND p.approval_status='approved' ORDER BY u.display_name`)).rows)));
router.get('/instructors/:instructorId/availability', asyncHandler(async (req, res) => {
  const parsed = id.safeParse(req.params.instructorId); if (!parsed.success) return res.status(400).json({ error: 'Invalid instructor id' });
  res.json((await pool.query('SELECT * FROM instructor_availability WHERE instructor_id=$1 AND available=true ORDER BY weekday,start_time', [parsed.data])).rows);
}));
router.get('/notifications', requireAuth, asyncHandler(async (req, res) => res.json((await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id])).rows)));
router.post('/instructor/apply', requireAuth, asyncHandler(async (req, res) => {
  const data = body(z.object({
    display_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional(),
    bio: z.string().trim().max(2000).optional(),
    license_number: z.string().trim().max(100),
  }), req, res); if (!data) return;
  const account = (await pool.query('SELECT student_approval_status FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (account?.student_approval_status !== 'approved') return res.status(403).json({ error: 'Your student account must be approved before you can apply to teach.' });
  await pool.query('UPDATE users SET display_name=$1 WHERE id=$2', [data.display_name, req.user.id]);
  const { rows } = await pool.query(
    `INSERT INTO instructor_profiles(user_id,phone,bio,license_number,approval_status)
     VALUES($1,$2,$3,$4,'pending')
     ON CONFLICT(user_id) DO UPDATE SET phone=EXCLUDED.phone,bio=EXCLUDED.bio,license_number=EXCLUDED.license_number,approval_status='pending'
     RETURNING approval_status`,
    [req.user.id, data.phone || null, data.bio || null, data.license_number],
  );
  await pool.query(`INSERT INTO notifications(user_id,title,message) SELECT id,'Instructor application received','Your instructor application is awaiting FirstGear approval.' FROM users WHERE contact='steveotien8@gmail.com'`);
  res.status(201).json(rows[0]);
}));
router.get('/admin/instructor-applications', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json((await pool.query(
    `SELECT u.id,u.display_name,u.contact,ip.phone,ip.bio,ip.license_number,ip.approval_status
     FROM instructor_profiles ip JOIN users u ON u.id=ip.user_id
     ORDER BY CASE ip.approval_status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,u.display_name`,
  )).rows);
}));
router.get('/admin/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json((await pool.query(
    `    SELECT u.id,u.display_name,u.contact,u.profile_image,u.student_approval_status,u.created_at,
      COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL),'{}') roles,
      ip.approval_status
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id=u.id
     LEFT JOIN roles r ON r.id=ur.role_id
     LEFT JOIN instructor_profiles ip ON ip.user_id=u.id
     GROUP BY u.id,ip.approval_status
     ORDER BY u.created_at DESC`,
  )).rows);
}));
router.patch('/admin/users/:userId/approval', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const userId = id.safeParse(req.params.userId);
  const data = body(z.object({ approval_status: z.enum(['approved', 'rejected', 'pending']) }), req, res);
  if (!userId.success) return res.status(400).json({ error: 'Invalid user id' });
  if (!data) return;
  const { rows } = await pool.query(
    `UPDATE users SET student_approval_status=$1 WHERE id=$2 RETURNING id,student_approval_status`,
    [data.approval_status, userId.data],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  await pool.query(
    `INSERT INTO notifications(user_id,title,message) VALUES($1,'Student account review', $2)`,
    [userId.data, `Your FirstGear student account has been ${data.approval_status}.`],
  );
  res.json(rows[0]);
}));
router.get('/admin/lesson-types', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json((await pool.query('SELECT * FROM lesson_types ORDER BY active DESC,duration_minutes DESC,name')).rows);
}));
router.get('/admin/payments', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json((await pool.query(
    `SELECT p.id,p.booking_id,p.amount_cents,p.status,p.provider_reference,p.created_at,
      s.display_name student_name,s.contact student_contact,lt.name lesson_type
     FROM payments p JOIN bookings b ON b.id=p.booking_id
     JOIN users s ON s.id=b.student_id JOIN lesson_types lt ON lt.id=b.lesson_type_id
     WHERE p.status='submitted' ORDER BY p.created_at`,
  )).rows);
}));
router.patch('/admin/lesson-types/:lessonTypeId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const lessonTypeId = id.safeParse(req.params.lessonTypeId);
  const data = body(z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    duration_minutes: z.number().int().positive(),
    price_cents: z.number().int().nonnegative(),
    active: z.boolean(),
  }), req, res);
  if (!lessonTypeId.success) return res.status(400).json({ error: 'Invalid lesson type id' });
  if (!data) return;
  const { rows } = await pool.query(
    `UPDATE lesson_types SET name=$1,description=$2,duration_minutes=$3,price_cents=$4,active=$5
     WHERE id=$6 RETURNING *`,
    [data.name, data.description || null, data.duration_minutes, data.price_cents, data.active, lessonTypeId.data],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Lesson type not found.' });
  res.json(rows[0]);
}));
router.patch('/admin/users/:userId/role', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const userId = id.safeParse(req.params.userId);
  const data = body(z.object({ role: z.enum(['student', 'instructor', 'admin']) }), req, res);
  if (!userId.success) return res.status(400).json({ error: 'Invalid user id' });
  if (!data) return;
  if (userId.data === req.user.id && data.role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = (await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId.data])).rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found.' });
    }
    await client.query('DELETE FROM user_roles WHERE user_id=$1', [userId.data]);
    await client.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2', [userId.data, data.role]);
    if (data.role === 'instructor') {
      await client.query(
        `INSERT INTO instructor_profiles(user_id,approval_status)
         VALUES($1,'pending') ON CONFLICT(user_id) DO NOTHING`,
        [userId.data],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ id: userId.data, role: data.role });
}));
router.patch('/admin/instructor-applications/:instructorId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const instructorId = id.safeParse(req.params.instructorId);
  const data = body(z.object({ approval_status: z.enum(['approved', 'rejected']) }), req, res);
  if (!instructorId.success) return res.status(400).json({ error: 'Invalid instructor id' });
  if (!data) return;
  const { rows } = await pool.query(
    `UPDATE instructor_profiles SET approval_status=$1,active=($1='approved')
     WHERE user_id=$2 RETURNING approval_status`,
    [data.approval_status, instructorId.data],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Instructor application not found.' });
  await pool.query(
    `INSERT INTO notifications(user_id,title,message) VALUES($1,$2,$3)`,
    [instructorId.data, `Instructor application ${data.approval_status}`, `Your FirstGear instructor application has been ${data.approval_status}.`],
  );
  res.json(rows[0]);
}));
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
    `SELECT u.display_name, u.contact, u.profile_image, ip.phone, ip.bio, ip.license_number, ip.active
     FROM users u LEFT JOIN instructor_profiles ip ON ip.user_id=u.id WHERE u.id=$1`,
    [req.user.id],
  )).rows[0];
  const bookings = (await pool.query(
    `SELECT b.id, b.starts_at, b.ends_at, b.status, b.notes, b.created_at,
      lt.name lesson_type, lt.duration_minutes, lt.price_cents,
      p.id payment_id, p.status payment_status, p.provider_reference payment_reference,
      s.id student_id, s.display_name student_name, s.contact student_contact
     FROM bookings b
     JOIN lesson_types lt ON lt.id=b.lesson_type_id
     LEFT JOIN payments p ON p.booking_id=b.id
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
  const profile = (await pool.query(
    `SELECT sp.*,u.display_name,u.contact,u.profile_image,u.student_approval_status
     FROM student_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.user_id=$1`,
    [req.user.id],
  )).rows[0];
  const bookings = (await pool.query(
    `SELECT b.*, lt.name lesson_type, lt.duration_minutes, lt.price_cents,
      u.display_name instructor_name, ip.bio instructor_bio
     FROM bookings b
     JOIN lesson_types lt ON lt.id=b.lesson_type_id
     LEFT JOIN users u ON u.id=b.instructor_id
     LEFT JOIN instructor_profiles ip ON ip.user_id=b.instructor_id
     WHERE b.student_id=$1
     ORDER BY b.starts_at`,
    [req.user.id],
  )).rows;
  const payments = (await pool.query(
    `SELECT id, booking_id, amount_cents, status, provider_reference, created_at
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
    studentApprovalStatus: req.user.student_approval_status,
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
    profile_image: z.string().max(2500000).nullable().optional(),
  }), req, res); if (!data) return;
  if (data.profile_image && !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(data.profile_image)) return res.status(400).json({ error: 'Profile picture must be a PNG, JPEG, WEBP, or GIF image.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET display_name=$1, contact=$2, profile_image=COALESCE($3,profile_image) WHERE id=$4', [data.display_name, data.contact.toLowerCase(), data.profile_image === undefined ? null : data.profile_image, req.user.id]);
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
router.patch('/profiles/account', requireAuth, asyncHandler(async (req, res) => {
  const data = body(z.object({
    display_name: z.string().trim().min(2).max(120),
    profile_image: z.string().max(2500000).nullable().optional(),
  }), req, res);
  if (!data) return;
  if (data.profile_image && !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(data.profile_image)) {
    return res.status(400).json({ error: 'Profile picture must be a PNG, JPEG, WEBP, or GIF image.' });
  }
  const { rows } = await pool.query(
    `UPDATE users SET display_name=$1,profile_image=COALESCE($2,profile_image) WHERE id=$3
     RETURNING id,display_name,contact,profile_image,student_approval_status`,
    [data.display_name, data.profile_image === undefined ? null : data.profile_image, req.user.id],
  );
  res.json(rows[0]);
}));
router.post('/bookings', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const data = body(z.object({ instructor_id: z.number().int().positive().nullable().optional(), lesson_type_id: z.number().int().positive(), starts_at: z.string().datetime(), ends_at: z.string().datetime(), notes: z.string().max(1000).optional() }), req, res); if (!data) return;
  if (data.instructor_id) {
    const blocked = await pool.query('SELECT 1 FROM instructor_blocks WHERE instructor_id=$1 AND starts_at < $3 AND ends_at > $2 LIMIT 1', [data.instructor_id, data.starts_at, data.ends_at]);
    if (blocked.rowCount) return res.status(409).json({ error: 'This instructor is unavailable during that time.' });
  }
  const lesson = (await pool.query('SELECT id,price_cents,name FROM lesson_types WHERE id=$1 AND active=true', [data.lesson_type_id])).rows[0];
  if (!lesson) return res.status(404).json({ error: 'Lesson option not found.' });
  const client = await pool.connect();
  let booking;
  let payment;
  try {
    await client.query('BEGIN');
    booking = (await client.query(`INSERT INTO bookings(student_id,instructor_id,lesson_type_id,starts_at,ends_at,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [req.user.id,data.instructor_id || null,data.lesson_type_id,data.starts_at,data.ends_at,data.notes])).rows[0];
    payment = (await client.query(
      `INSERT INTO payments(booking_id,user_id,amount_cents,status) VALUES($1,$2,$3,'pending') RETURNING id,booking_id,amount_cents,status`,
      [booking.id, req.user.id, lesson.price_cents],
    )).rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await pool.query(
    `INSERT INTO notifications(user_id,title,message) VALUES($1,'Payment required for your lesson',$2)`,
    [req.user.id, `Your ${lesson.name} booking is awaiting payment. Transfer £${(lesson.price_cents / 100).toFixed(2)} and submit the bank reference.`],
  );
  if (!data.instructor_id) await pool.query(`INSERT INTO notifications(user_id,title,message) SELECT id,'New student booking request','A student has requested a lesson and needs an instructor assignment.' FROM users WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=users.id AND r.name='admin')`);
  res.status(201).json({ ...booking, payment });
}));
router.post('/payments/:paymentId/reference', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const paymentId = id.safeParse(req.params.paymentId);
  const data = body(z.object({ provider_reference: z.string().trim().min(1).max(100) }), req, res);
  if (!paymentId.success) return res.status(400).json({ error: 'Invalid payment id' });
  if (!data) return;
  const { rows } = await pool.query(
    `UPDATE payments SET provider_reference=$1,status='submitted'
     WHERE id=$2 AND user_id=$3 AND status IN ('pending','submitted')
     RETURNING id,booking_id,amount_cents,status,provider_reference`,
    [data.provider_reference, paymentId.data, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found or already approved.' });
  await pool.query(
    `INSERT INTO notifications(user_id,title,message)
     SELECT DISTINCT u.id,'Payment reference submitted',$2
     FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
     WHERE r.name='admin'
        OR EXISTS (SELECT 1 FROM bookings b WHERE b.id=$3 AND b.instructor_id=u.id)`,
    [req.user.id, `A student submitted payment reference ${data.provider_reference} for review.`, rows[0].booking_id],
  );
  res.json(rows[0]);
}));
router.patch('/payments/:paymentId/approve', requireAuth, requireRole('instructor','admin'), asyncHandler(async (req, res) => {
  const paymentId = id.safeParse(req.params.paymentId);
  if (!paymentId.success) return res.status(400).json({ error: 'Invalid payment id' });
  const { rows } = await pool.query(
    `UPDATE payments p SET status='paid',reviewed_by=$1,reviewed_at=NOW()
     WHERE p.id=$2 AND p.status='submitted'
       AND (EXISTS (SELECT 1 FROM bookings b WHERE b.id=p.booking_id AND b.instructor_id=$1) OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name='admin'))
     RETURNING p.id,p.booking_id,p.status,p.provider_reference`,
    [req.user.id, paymentId.data],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Submitted payment not found or not assigned to you.' });
  await pool.query(`INSERT INTO notifications(user_id,title,message) SELECT b.student_id,'Payment approved','Your bank transfer has been approved by FirstGear.' FROM bookings b WHERE b.id=$1`, [rows[0].booking_id]);
  res.json(rows[0]);
}));
router.get('/bookings', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT b.*,lt.name lesson_type,u.display_name instructor_name FROM bookings b JOIN lesson_types lt ON lt.id=b.lesson_type_id LEFT JOIN users u ON u.id=b.instructor_id WHERE b.student_id=$1 OR b.instructor_id=$1 ORDER BY b.starts_at`, [req.user.id]); res.json(rows);
}));
router.get('/admin/unassigned-bookings', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT b.id,b.starts_at,b.ends_at,b.status,lt.name lesson_type,u.display_name student_name,u.contact student_contact FROM bookings b JOIN lesson_types lt ON lt.id=b.lesson_type_id JOIN users u ON u.id=b.student_id WHERE b.instructor_id IS NULL AND b.status NOT IN ('cancelled','completed') ORDER BY b.starts_at`);
  res.json(rows);
}));
router.patch('/admin/bookings/:bookingId/assign', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const bookingId = id.safeParse(req.params.bookingId);
  if (!bookingId.success) return res.status(400).json({ error: 'Invalid booking id' });
  const { rows } = await pool.query(`UPDATE bookings SET instructor_id=$1,status='confirmed',updated_at=NOW() WHERE id=$2 AND instructor_id IS NULL RETURNING id`, [req.user.id, bookingId.data]);
  if (!rows[0]) return res.status(404).json({ error: 'Unassigned booking not found.' });
  res.json(rows[0]);
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
