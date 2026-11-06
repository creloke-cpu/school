import { useEffect, useRef, useState } from 'react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const footerLinks = [
  ['FAQ', '#faq'],
  ['Help Centre', '#help'],
  ['FirstGear Shop', '#shop'],
  ['Terms of Use', '#terms'],
  ['Privacy', '#privacy'],
  ['Cookie Preferences', '#cookies'],
  ['Corporate Information', '#corporate'],
  ['Advert choices', '#advertising'],
];

export default function App() {
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [reviewStep, setReviewStep] = useState(false);
  const [specialOffers, setSpecialOffers] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [dashboard, setDashboard] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [devLink, setDevLink] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const contactInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          setContact(result.user.contact);
          setDashboard(true);
        }
      })
      .catch(() => setAuthError('We could not check your sign-in status.'))
      .finally(() => setAuthLoading(false));
  }, []);

  const continueSignIn = (event) => {
    event.preventDefault();
    if (!contact.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setReviewStep(true);
  };

  const changeContact = () => {
    setDashboard(false);
    setLinkSent(false);
    setReviewStep(false);
    requestAnimationFrame(() => contactInputRef.current?.focus());
  };

  const requestLink = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contact }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send sign-in link.');
      setDevLink(result.devLink || '');
      setLinkSent(true);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
    setDashboard(false);
    setLinkSent(false);
    setReviewStep(false);
  };

  if (authLoading && !user) {
    return <main className="page"><p className="loading-message">Loading FirstGear...</p></main>;
  }

  if (dashboard) {
    if (user?.roles?.includes('admin')) {
      return <AdminDashboard contact={contact} user={user} onSignOut={signOut} />;
    }
    if (user?.roles?.includes('instructor')) {
      return <InstructorDashboard contact={contact} user={user} onSignOut={signOut} />;
    }
    return <StudentDashboard contact={contact} onSignOut={signOut} />;
  }

  if (!showLogin) return <LandingPage onSignIn={() => setShowLogin(true)} />;

  return (
    <main className="page">
      <header className="header">
        <a className="logo" href="/" aria-label="FirstGear home">FIRSTGEAR</a>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        {linkSent ? (
          <section aria-labelledby="link-title">
            <h1 id="link-title">Tap the sign-in link</h1>
            <p className="intro">
              We sent a one-time sign-in link to the contact below. Simply tap
              the link to continue.
            </p>
            <div className="review-contact-row">
              <p className="review-contact">{contact}</p>
              <button className="change-link" type="button" onClick={changeContact}>
                Change
              </button>
            </div>
            <p className="resend-copy">
              Didn&apos;t get a link? Check your spam or messages, then{' '}
              <button
                className="inline-link"
                type="button"
                onClick={() => setResendMessage('A new link has been sent.')}
              >
                resend it
              </button>
              .
            </p>
            {resendMessage && <p className="resend-message">{resendMessage}</p>}
            {devLink && <a className="continue-button dev-link" href={devLink}>Open sign-in link</a>}
            <button className="secondary-button" type="button" onClick={() => setHelpOpen(true)}>
              Get help
            </button>
          </section>
        ) : !reviewStep ? (
          <>
            <h1 id="login-title">Enter your info to sign in</h1>
            <p className="intro">Or get started with a new account.</p>

            <form onSubmit={continueSignIn} noValidate>
              <label htmlFor="contact">Email address</label>
              <input
                id="contact"
                ref={contactInputRef}
                name="contact"
                type="email"
                autoComplete="email"
                value={contact}
                onChange={(event) => {
                  setContact(event.target.value);
                  setError('');
                }}
                aria-describedby={error ? 'form-error' : undefined}
                aria-invalid={Boolean(error)}
              />
              {error && <p id="form-error" className="form-error">{error}</p>}
              <button className="continue-button" type="submit">Continue</button>
            </form>
          </>
        ) : (
          <section aria-labelledby="review-title">
            <h1 id="review-title">Review to continue</h1>
            <p className="intro">Check your details before continuing.</p>
            <div className="review-contact-row">
              <p className="review-contact">{contact}</p>
              <button
                className="change-link"
                type="button"
                onClick={changeContact}
              >
                Change
              </button>
            </div>
            <label className="offers-option">
              <input
                type="checkbox"
                checked={specialOffers}
                onChange={(event) => setSpecialOffers(event.target.checked)}
              />
              <span>Please do not email me FirstGear special offers</span>
            </label>
            <button className="continue-button" type="button" onClick={requestLink} disabled={authLoading}>
              Continue
            </button>
            {authError && <p className="form-error">{authError}</p>}
          </section>
        )}

        <button
          className="help-toggle"
          type="button"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen(!helpOpen)}
        >
          Need help? <span className={helpOpen ? 'arrow open' : 'arrow'}>›</span>
        </button>
        {helpOpen && (
          <div className="help-panel">
            <p>Visit the Help Centre for answers about signing in, accounts, and billing.</p>
            <a href="#help">Go to Help Centre</a>
          </div>
        )}
      </section>

      <footer className="footer">
        <p>Questions? Call <a href="tel:+447512623380">+44 7512 623380</a></p>
        <nav aria-label="Footer links">
          {footerLinks.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer">{label}</a>
          ))}
        </nav>
      </footer>
    </main>
  );
}

function LandingPage({ onSignIn }) {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="logo" href="/" aria-label="FirstGear home">FIRSTGEAR</a>
        <button className="landing-signin" type="button" onClick={onSignIn}>Sign in</button>
      </header>
      <section className="landing-hero">
        <div>
          <p className="eyebrow">UK DRIVING SCHOOL</p>
          <h1>Learn to drive with confidence.</h1>
          <p className="landing-lede">Friendly, practical lessons with qualified instructors across the UK. Book your next step towards the open road.</p>
          <div className="landing-actions">
            <button className="continue-button" type="button" onClick={onSignIn}>Sign up / sign in</button>
            <a className="secondary-button" href="#lessons">Explore lessons</a>
          </div>
        </div>
        <div className="landing-price-card">
          <span className="eyebrow">POPULAR LESSON</span>
          <strong>£45</strong>
          <span>per hour</span>
          <small>60-minute practical driving lesson</small>
        </div>
      </section>
      <section className="landing-stats" id="lessons">
        <article><strong>£45/hr</strong><span>Clear, simple pricing</span></article>
        <article><strong>1-to-1</strong><span>Personal instructor support</span></article>
        <article><strong>UK-wide</strong><span>Lessons built around you</span></article>
      </section>
      <section className="landing-info">
        <p className="eyebrow">WHY FIRSTGEAR</p>
        <h2>Everything you need to become a safer, more confident driver.</h2>
        <div className="landing-cards">
          <article><h3>Qualified instructors</h3><p>Learn with experienced driving instructors who make every lesson practical and encouraging.</p></article>
          <article><h3>Flexible scheduling</h3><p>Find lesson times that fit around work, study, and everyday life.</p></article>
          <article><h3>Track your progress</h3><p>See your upcoming lessons, completed practice, and next milestones in one place.</p></article>
        </div>
      </section>
      <footer className="footer"><p>Ready to get started? <button className="inline-link" type="button" onClick={onSignIn}>Create your account</button></p></footer>
    </main>
  );
}

function AdminDashboard({ contact, user, onSignOut }) {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/instructor-applications`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load instructor applications.');
      setApplications(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadApplications(); }, []);
  const decide = async (id, approval_status) => {
    setError('');
    const response = await fetch(`${API_BASE}/api/admin/instructor-applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ approval_status }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Unable to update application.');
      return;
    }
    loadApplications();
  };
  const pending = applications.filter((application) => application.approval_status === 'pending');
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="logo" href="/" aria-label="FirstGear home">FIRSTGEAR</a>
        <div className="header-actions"><span>{contact}</span><button className="text-button" type="button" onClick={onSignOut}>Sign out</button></div>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">SUPERADMIN</p>
        <h1>Instructor approvals</h1>
        <p className="view-intro">Review instructor applications before they can accept student bookings.</p>
        <div className="stats-grid"><div><strong>{pending.length}</strong><span>Pending review</span></div><div><strong>{applications.filter((application) => application.approval_status === 'approved').length}</strong><span>Approved instructors</span></div><div><strong>{applications.length}</strong><span>Total applications</span></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="dashboard-panel admin-applications">
          <div className="panel-heading"><div><p className="eyebrow">APPLICATIONS</p><h2>Instructor applications</h2></div><button className="text-button" type="button" onClick={loadApplications}>Refresh</button></div>
          {loading ? <p className="muted">Loading applications...</p> : applications.length === 0 ? <p className="muted">No instructor applications yet.</p> : applications.map((application) => (
            <article className="application-row" key={application.id}>
              <div><strong>{application.display_name}</strong><span>{application.contact}</span><small>Licence: {application.license_number || 'Not provided'}</small>{application.bio && <p>{application.bio}</p>}</div>
              <div className="application-status"><span className={`status-pill ${application.approval_status}`}>{application.approval_status}</span>{application.approval_status === 'pending' && <div><button className="book-button compact" type="button" onClick={() => decide(application.id, 'approved')}>Approve</button><button className="text-button" type="button" onClick={() => decide(application.id, 'rejected')}>Reject</button></div>}</div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}

function InstructorDashboard({ contact, user, onSignOut }) {
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOverview = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/instructor/overview`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : response.json().then((result) => { throw new Error(result.error || 'Unable to load instructor portal.'); }))
      .then(setOverview)
      .catch((error) => setActionMessage(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadOverview, []);
  useEffect(() => {
    setMenuOpen(false);
  }, [activeTab]);

  const updateBooking = async (booking, status) => {
    try {
      const response = await fetch(`${API_BASE}/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update lesson.');
      setActionMessage(`Lesson marked ${status}.`);
      loadOverview();
    } catch (error) {
      setActionMessage(error.message);
    }
  };

  if (loading || !overview) return <main className="page"><p className="loading-message">Loading instructor portal...</p></main>;
  const profile = overview.profile || {};
  const upcoming = overview.bookings.filter((booking) => ['pending', 'confirmed'].includes(booking.status));
  const nextLesson = upcoming[0];
  const initials = (profile.display_name || 'Instructor').slice(0, 2).toUpperCase();
  const nav = [['home', '⌂', 'Home'], ['schedule', '◷', 'Schedule'], ['students', '●', 'Students'], ['account', '◆', 'Account']];

  return (
    <main className="dashboard-page instructor-portal">
      <header className="dashboard-header">
        <a className="logo" href="/" aria-label="FirstGear home">FIRSTGEAR</a>
        <nav className="dashboard-nav" aria-label="Instructor navigation">
          <button className={activeTab === 'home' ? 'active' : ''} type="button" onClick={() => setActiveTab('home')}>Overview</button>
          <button className={activeTab === 'schedule' ? 'active' : ''} type="button" onClick={() => setActiveTab('schedule')}>My schedule</button>
          <button className={activeTab === 'students' ? 'active' : ''} type="button" onClick={() => setActiveTab('students')}>Students</button>
        </nav>
        <div className="profile-actions">
          <span className="student-name">{profile.display_name}</span>
          <button className="user-menu-button" type="button" aria-label="Open user menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span className="user-avatar">{initials}</span><span className="burger-icon"><i /><i /><i /></span>
          </button>
          {menuOpen && <div className="user-menu"><strong>{profile.display_name}</strong><span>{contact}</span><button type="button" onClick={() => { setActiveTab('account'); setMenuOpen(false); }}>Profile</button><button type="button" onClick={() => { setMenuOpen(false); setActionMessage('Your instructor inbox is up to date.'); }}>Inbox</button><button type="button" onClick={() => { setMenuOpen(false); setActionMessage('Instructor help is available from the support centre.'); }}>Help</button><button type="button" onClick={() => { setMenuOpen(false); setActionMessage('Safety guidance and driving support are available here.'); }}>Safety</button><button type="button" onClick={onSignOut}>Sign out</button></div>}
        </div>
      </header>
      <div className="dashboard-content">
        {actionMessage && <div className="action-message" role="status">{actionMessage}<button type="button" onClick={() => setActionMessage('')}>×</button></div>}
        {activeTab === 'home' && <>
          <section className="welcome"><div><div className="live-label"><span /> INSTRUCTOR PORTAL</div><h1>Your teaching day</h1><p>Welcome back, {profile.display_name}. Here is what is coming up with your students.</p></div><button className="book-button" type="button" onClick={() => setActiveTab('schedule')}>View schedule</button></section>
          <section className="stats-grid" aria-label="Instructor summary"><article className="stat-card accent-card"><span className="stat-icon">◷</span><div><strong>{overview.stats.upcomingLessons}</strong><span>Upcoming lessons</span></div></article><article className="stat-card accent-card"><span className="stat-icon">●</span><div><strong>{overview.stats.activeStudents}</strong><span>Active students</span></div></article><article className="stat-card accent-card"><span className="stat-icon">★</span><div><strong>{overview.stats.completedLessons}</strong><span>Lessons completed</span></div></article></section>
          <div className="dashboard-grid"><section className="dashboard-panel next-lesson"><div className="panel-heading"><div><p className="eyebrow">NEXT LESSON</p><h2>{nextLesson?.lesson_type || 'No upcoming lessons'}</h2></div><span className="status-pill">{nextLesson?.status || 'Clear'}</span></div>{nextLesson ? <><div className="lesson-date"><strong>{new Date(nextLesson.starts_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</strong><b>{new Date(nextLesson.starts_at).getDate()}</b><span>{new Date(nextLesson.starts_at).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span></div><div className="lesson-details"><p><strong>{new Date(nextLesson.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(nextLesson.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></p><p>Student: {nextLesson.student_name}</p><p>{nextLesson.notes || 'Prepare for your upcoming lesson.'}</p></div><div className="lesson-actions"><button className="book-button" type="button" onClick={() => updateBooking(nextLesson, 'completed')}>Mark completed</button><button className="text-button" type="button" onClick={() => updateBooking(nextLesson, 'cancelled')}>Cancel lesson</button></div></> : <p className="muted">Your schedule is clear.</p>}</section><section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">AVAILABILITY</p><h2>Teaching hours</h2></div><strong>{overview.availability.length}</strong></div><p className="muted">{overview.blocks.length ? `${overview.blocks.length} blocked period(s) coming up.` : 'Block dates or times when you cannot teach.'}</p><button className="text-button" type="button" onClick={() => setActiveTab('account')}>Manage availability →</button></section></div>
          <section className="dashboard-panel history-panel"><div className="panel-heading"><div><p className="eyebrow">UPCOMING</p><h2>Next students</h2></div><button className="text-button" type="button" onClick={() => setActiveTab('schedule')}>See all →</button></div>{upcoming.slice(0, 3).map((booking) => <div className="history-row" key={booking.id}><span className="history-date">{new Date(booking.starts_at).toLocaleDateString()}</span><strong>{booking.student_name}</strong><span className="history-instructor">{booking.lesson_type}</span><span className="completed">{booking.status}</span></div>)}{!upcoming.length && <p className="muted">No upcoming student lessons.</p>}</section>
        </>}
        {activeTab === 'schedule' && <InstructorSchedule bookings={overview.bookings} onUpdate={updateBooking} onMoved={() => { setActionMessage('Lesson moved successfully.'); loadOverview(); }} />}
        {activeTab === 'students' && <InstructorStudents bookings={overview.bookings} />}
        {activeTab === 'account' && <><InstructorAccount profile={profile} onSaved={loadOverview} /><InstructorAvailability availability={overview.availability} blocks={overview.blocks} onSaved={loadOverview} /></>}
      </div>
      <nav className="floating-nav" aria-label="Main navigation">{nav.map(([tab, icon, label]) => <button className={activeTab === tab ? 'active' : ''} type="button" key={tab} onClick={() => setActiveTab(tab)}><span>{icon}</span><small>{label}</small></button>)}</nav>
    </main>
  );
}

function InstructorAccount({ profile, onSaved }) {
  const [form, setForm] = useState({
    display_name: profile.display_name || '',
    contact: profile.contact || '',
    phone: profile.phone || '',
    bio: profile.bio || '',
    license_number: profile.license_number || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/instructor/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save profile.');
      setMessage('Profile details saved.');
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  return <section className="dashboard-panel app-view account-editor"><p className="eyebrow">INSTRUCTOR ACCOUNT</p><h1>Edit profile</h1><p className="view-intro">Keep your contact details up to date so FirstGear and your students can reach you.</p><form className="profile-form" onSubmit={save}><label htmlFor="instructor-name">Name</label><input id="instructor-name" value={form.display_name} onChange={update('display_name')} required /><label htmlFor="instructor-email">Email</label><input id="instructor-email" type="email" value={form.contact} onChange={update('contact')} required /><label htmlFor="instructor-phone">Phone number</label><input id="instructor-phone" type="tel" value={form.phone} onChange={update('phone')} placeholder="+44 7000 000000" /><label htmlFor="instructor-license">Licence number</label><input id="instructor-license" value={form.license_number} onChange={update('license_number')} /><label htmlFor="instructor-bio">Bio</label><textarea id="instructor-bio" value={form.bio} onChange={update('bio')} rows="4" placeholder="Tell students about your experience" /><button className="book-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>{message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}</form></section>;
}

function InstructorAvailability({ availability, blocks, onSaved }) {
  const [form, setForm] = useState({ starts_at: '', ends_at: '', reason: '' });
  const [error, setError] = useState('');
  const addBlock = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/instructor/blocks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), reason: form.reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to block this time.');
      setForm({ starts_at: '', ends_at: '', reason: '' });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    }
  };
  const removeBlock = async (block) => {
    const response = await fetch(`${API_BASE}/api/instructor/blocks/${block.id}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Unable to remove blocked time.');
      return;
    }
    onSaved();
  };
  return <section className="dashboard-panel app-view availability-editor"><p className="eyebrow">AVAILABILITY</p><h1>Block calendar time</h1><p className="view-intro">Students cannot book during these periods. Use this for holidays, appointments, or personal time.</p><div className="availability-hours"><strong>Weekly teaching hours</strong>{availability.length ? availability.map((item) => <span key={item.id}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.weekday]} {String(item.start_time).slice(0, 5)}–{String(item.end_time).slice(0, 5)}</span>) : <span className="muted">No weekly hours configured.</span>}</div><form className="profile-form" onSubmit={addBlock}><label htmlFor="block-start">Unavailable from</label><input id="block-start" type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} required /><label htmlFor="block-end">Unavailable until</label><input id="block-end" type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} required /><label htmlFor="block-reason">Reason (optional)</label><input id="block-reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Holiday, appointment, unavailable" /><button className="book-button" type="submit">Block this time</button>{error && <p className="form-error" role="alert">{error}</p>}</form><div className="blocked-list"><h2>Upcoming blocked times</h2>{blocks.length ? blocks.map((block) => <div className="blocked-row" key={block.id}><div><strong>{new Date(block.starts_at).toLocaleString()}</strong><span> until {new Date(block.ends_at).toLocaleString()}</span>{block.reason && <small>{block.reason}</small>}</div><button className="text-button" type="button" onClick={() => removeBlock(block)}>Remove</button></div>) : <p className="muted">No blocked times.</p>}</div></section>;
}

function InstructorSchedule({ bookings, onUpdate, onMoved }) {
  const [month, setMonth] = useState(() => new Date());
  const [lessonFilter, setLessonFilter] = useState('upcoming');
  const [movingBooking, setMovingBooking] = useState(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveTime, setMoveTime] = useState('10:00');
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
  const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const lessonsForDay = (date) => bookings.filter((booking) => dayKey(new Date(booking.starts_at)) === dayKey(date));
  const todayKey = dayKey(new Date());
  const upcomingBookings = bookings.filter((booking) => new Date(booking.ends_at) >= new Date() && booking.status !== 'completed' && booking.status !== 'cancelled');
  const pastBookings = bookings.filter((booking) => new Date(booking.ends_at) < new Date() || booking.status === 'completed');
  const visibleBookings = lessonFilter === 'past' ? pastBookings : upcomingBookings;
  const openMove = (booking) => {
    const start = new Date(booking.starts_at);
    setMovingBooking(booking);
    setMoveDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
    setMoveTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
  };
  const submitMove = async (event) => {
    event.preventDefault();
    const startsAt = new Date(`${moveDate}T${moveTime}`);
    const endsAt = new Date(startsAt.getTime() + (movingBooking.duration_minutes || 60) * 60000);
    const response = await fetch(`${API_BASE}/api/bookings/${movingBooking.id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }),
    });
    const result = await response.json();
    if (!response.ok) {
      window.alert(result.error || 'Unable to move lesson.');
      return;
    }
    setMovingBooking(null);
    onMoved();
  };

  return <section className="app-view schedule-view">
    <p className="eyebrow">SCHEDULE</p>
    <div className="schedule-title"><div><h1>My calendar</h1><p className="view-intro">Upcoming lessons at a glance.</p></div><div className="calendar-controls"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div>
    <div className="calendar-card">
      <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{cells.map((date, index) => {
        const lessons = date ? lessonsForDay(date) : [];
        return <div className={`calendar-day${date && dayKey(date) === todayKey ? ' today' : ''}${date ? '' : ' empty'}`} key={date ? dayKey(date) : `empty-${index}`}>
          {date && <><span className="calendar-date">{date.getDate()}</span>{lessons.map((booking) => <div className="calendar-lesson" key={booking.id} title={`${booking.student_name} - ${booking.lesson_type}`}><strong>{new Date(booking.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><span>{booking.student_name}</span></div>)}</>}
        </div>;
      })}</div>
    </div>
    <div className="schedule-filters" role="tablist" aria-label="Lesson history filter"><button className={lessonFilter === 'upcoming' ? 'active' : ''} type="button" role="tab" aria-selected={lessonFilter === 'upcoming'} onClick={() => setLessonFilter('upcoming')}>Upcoming ({upcomingBookings.length})</button><button className={lessonFilter === 'past' ? 'active' : ''} type="button" role="tab" aria-selected={lessonFilter === 'past'} onClick={() => setLessonFilter('past')}>Past lessons ({pastBookings.length})</button></div>
    <div className="dashboard-panel detail-list schedule-list"><div className="panel-heading"><div><p className="eyebrow">{lessonFilter === 'past' ? 'HISTORY' : 'LESSON LIST'}</p><h2>{lessonFilter === 'past' ? 'Past lessons' : 'Upcoming lessons'}</h2></div><span className="status-pill">{visibleBookings.length}</span></div>{visibleBookings.length ? visibleBookings.map((booking) => <div className="detail-row" key={booking.id}><span>{new Date(booking.starts_at).toLocaleString()}</span><strong>{booking.student_name}<br /><small>{booking.lesson_type}</small></strong><span className="status-pill">{booking.status}</span>{lessonFilter === 'upcoming' && ['pending', 'confirmed'].includes(booking.status) && <><button className="text-button" type="button" onClick={() => openMove(booking)}>Move</button><button className="text-button" type="button" onClick={() => onUpdate(booking, 'completed')}>Complete</button></>}</div>) : <p className="muted">{lessonFilter === 'past' ? 'No past lessons yet.' : 'No upcoming lessons scheduled.'}</p>}</div>
    {movingBooking && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMovingBooking(null); }}><section className="dashboard-panel detail-view message-dialog" role="dialog" aria-modal="true"><div className="panel-heading"><div><p className="eyebrow">MOVE LESSON</p><h2>{movingBooking.student_name}</h2></div><button className="dialog-close" type="button" onClick={() => setMovingBooking(null)} aria-label="Close move lesson dialog">×</button></div><p className="muted">{movingBooking.lesson_type}</p><form className="reschedule-form" onSubmit={submitMove}><label htmlFor="move-date">New date</label><input id="move-date" type="date" min={new Date().toISOString().slice(0, 10)} value={moveDate} onChange={(event) => setMoveDate(event.target.value)} required /><label htmlFor="move-time">New start time</label><input id="move-time" type="time" value={moveTime} onChange={(event) => setMoveTime(event.target.value)} required /><button className="book-button" type="submit">Save new time</button></form></section></div>}
  </section>;
}

function InstructorStudents({ bookings }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const students = [...new Map(bookings.map((booking) => [booking.student_id, booking])).values()];
  const filtered = students.filter((student) => `${student.student_name} ${student.student_contact}`.toLowerCase().includes(query.toLowerCase()));
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const changeQuery = (event) => {
    setQuery(event.target.value);
    setPage(1);
  };
  const sendMessage = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/api/instructor/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: selectedStudent.student_id, message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send message.');
      setSelectedStudent(null);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSending(false);
    }
  };
  return <section className="app-view students-view"><p className="eyebrow">STUDENTS</p><h1>My students</h1><p className="view-intro">Search and manage students assigned to your lessons.</p><div className="student-toolbar"><label className="search-field" htmlFor="student-search"><span>⌕</span><input id="student-search" type="search" placeholder="Search students" value={query} onChange={changeQuery} /></label><span className="muted">{filtered.length} student{filtered.length === 1 ? '' : 's'}</span></div><div className="dashboard-panel student-list">{visible.length ? visible.map((student) => <button className="student-row" type="button" key={student.student_id} onClick={() => setSelectedStudent(student)}><span className="student-avatar-small">{student.student_name.slice(0, 2).toUpperCase()}</span><span className="student-row-info"><strong>{student.student_name}</strong><small>{student.student_contact}</small></span><span className="student-row-arrow">›</span></button>) : <p className="muted">No students found.</p>}<div className="pagination"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next</button></div></div>{selectedStudent && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStudent(null); }}><section className="dashboard-panel detail-view message-dialog" role="dialog" aria-modal="true"><div className="panel-heading"><div><p className="eyebrow">STUDENT</p><h2>{selectedStudent.student_name}</h2></div><button className="dialog-close" type="button" onClick={() => setSelectedStudent(null)} aria-label="Close student dialog">×</button></div><p className="muted">{selectedStudent.student_contact}</p><p className="muted">Assigned lesson: {selectedStudent.lesson_type}</p><form className="message-form" onSubmit={sendMessage}><label htmlFor="student-message">Message student</label><textarea id="student-message" placeholder={`Message ${selectedStudent.student_name}`} value={message} onChange={(event) => setMessage(event.target.value)} required /><button className="book-button" type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send message'}</button></form></section></div>}</section>;
}

function StudentDashboard({ contact, onSignOut }) {
  const [overview, setOverview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [activePanel, setActivePanel] = useState(null);
  const [instructorApplication, setInstructorApplication] = useState({ display_name: '', phone: '', bio: '', license_number: '' });
  const [applicationStatus, setApplicationStatus] = useState('');
  const [applicationSaving, setApplicationSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/student/overview`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load your student data.');
        return result;
      })
      .then(setOverview)
      .catch((error) => setLoadError(error.message));
  }, []);

  if (loadError) {
    return <main className="dashboard-page"><div className="dashboard-content"><p className="form-error">{loadError}</p><button className="book-button" type="button" onClick={onSignOut}>Return to sign in</button></div></main>;
  }

  if (!overview) {
    return <main className="dashboard-page"><p className="loading-message">Loading your FirstGear student portal...</p></main>;
  }

  const lesson = overview.nextLesson;
  const instructor = lesson?.instructor_name || 'Not assigned';
  const completedLessons = overview.progress.completedLessons;
  const progressPercent = overview.progress.overallPercent;
  const balance = overview.payments.reduce((total, payment) => total + (payment.status === 'paid' ? payment.amount_cents : 0), 0);
  const showAction = (message, target) => {
    setActionMessage(message);
    if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const selectTab = (tab) => {
    setActiveTab(tab);
    setUserMenuOpen(false);
    if (tab === 'home') showAction('You are viewing your student overview.', 'overview');
    if (tab === 'book') showAction('Lesson booking is ready. Choose a lesson time with your instructor.', 'lessons');
    if (tab === 'activity') showAction(`${overview.bookings.length} lesson booking(s) loaded from PostgreSQL.`, 'history');
  };
  const openPanel = (panel) => {
    setActiveTab('home');
    setUserMenuOpen(false);
    setActivePanel(panel);
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    if (!selectedLesson || !bookingDate) {
      setActionMessage('Choose a lesson and date first.');
      return;
    }

    const startsAt = new Date(`${bookingDate}T${bookingTime}`);
    const endsAt = new Date(startsAt.getTime() + selectedLesson.duration_minutes * 60000);
    setBookingLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructor_id: 3,
          lesson_type_id: selectedLesson.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          notes: 'Booked from the student portal',
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to book this lesson.');
      setActionMessage('Lesson booked successfully.');
      setSelectedLesson(null);
      setBookingDate('');
      const overviewResponse = await fetch(`${API_BASE}/api/student/overview`, { credentials: 'include' });
      if (overviewResponse.ok) setOverview(await overviewResponse.json());
    } catch (error) {
      setActionMessage(error.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const submitInstructorApplication = async (event) => {
    event.preventDefault();
    setApplicationSaving(true);
    setApplicationStatus('');
    try {
      const response = await fetch(`${API_BASE}/api/instructor/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(instructorApplication),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit instructor application.');
      setApplicationStatus('Application submitted. FirstGear will review your details.');
    } catch (error) {
      setApplicationStatus(error.message);
    } finally {
      setApplicationSaving(false);
    }
  };

  const submitReschedule = async (event) => {
    event.preventDefault();
    if (!selectedBooking || !rescheduleDate) return;
    const startsAt = new Date(`${rescheduleDate}T${rescheduleTime}`);
    const endsAt = new Date(startsAt.getTime() + selectedBooking.duration_minutes * 60000);
    setBookingLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/bookings/${selectedBooking.id}/schedule`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to reschedule this lesson.');
      setActionMessage('Reschedule request saved. Your instructor will confirm the new time.');
      setSelectedBooking(null);
      const overviewResponse = await fetch(`${API_BASE}/api/student/overview`, { credentials: 'include' });
      if (overviewResponse.ok) setOverview(await overviewResponse.json());
    } catch (error) {
      setActionMessage(error.message);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="logo" href="/" aria-label="FirstGear home">FIRSTGEAR</a>
        <nav className="dashboard-nav" aria-label="Student navigation">
          <a className="active" href="#overview">Overview</a>
          <a href="#lessons">My lessons</a>
          <a href="#progress">Progress</a>
          <a href="#payments">Payments</a>
        </nav>
        <div className="profile-actions">
          <span className="student-name">{overview.profile?.phone || contact}</span>
          <button
            className="user-menu-button"
            type="button"
            aria-label="Open user menu"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <span className="user-avatar">S</span>
            <span className="burger-icon"><i /><i /><i /></span>
          </button>
          {userMenuOpen && (
            <div className="user-menu">
              <strong>{overview.profile?.display_name || 'Student'}</strong>
              <span>{contact}</span>
              <button type="button" onClick={() => openPanel('instructor')}>Profile</button>
              <button type="button" onClick={() => showAction('Your inbox is up to date.')}>Inbox</button>
              <button type="button" onClick={() => openPanel('payments')}>Wallet</button>
              <button type="button" onClick={() => showAction('FirstGear help is available from the support centre.')}>Help</button>
              <button type="button" onClick={() => showAction('Safety guidance and driving support are available here.')}>Safety</button>
              <button type="button" onClick={onSignOut}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-content">
        {activeTab === 'home' && (
          <>
        <section className="welcome" id="overview">
          <div>
            <div className="live-label"><span /> LIVE STUDENT PORTAL</div>
            <h1>Your driving journey</h1>
            <p>Welcome back, {overview.profile?.display_name || 'Student'}. Here is everything you need for your next lesson.</p>
          </div>
          <button className="book-button" type="button" onClick={() => selectTab('book')}>+ Book a lesson</button>
        </section>
        {actionMessage && <div className="action-message" role="status">{actionMessage}<button type="button" onClick={() => setActionMessage('')}>×</button></div>}

        <section className="stats-grid" aria-label="Driving progress summary">
          <article className="stat-card accent-card">
            <span className="stat-icon">◷</span>
            <div><strong>{completedLessons}</strong><span>Lessons completed</span></div>
          </article>
          <article className="stat-card accent-card">
            <span className="stat-icon">↗</span>
            <div><strong>{progressPercent}%</strong><span>Overall progress</span></div>
          </article>
          <article className="stat-card accent-card">
            <span className="stat-icon">★</span>
            <div><strong>{overview.notifications.length}</strong><span>Notifications</span></div>
          </article>
        </section>

        <div className="dashboard-grid">
          <section className="dashboard-panel next-lesson" id="lessons">
            <div className="panel-heading">
              <div><p className="eyebrow">NEXT LESSON</p><h2>{lesson?.lesson_type || 'No lesson booked'}</h2></div>
              <span className="status-pill">{lesson?.status || 'Book now'}</span>
            </div>
            <div className="lesson-date"><strong>{lesson ? new Date(lesson.starts_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase() : '—'}</strong><b>{lesson ? new Date(lesson.starts_at).getDate() : '—'}</b><span>{lesson ? new Date(lesson.starts_at).toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : ''}</span></div>
            <div className="lesson-details">
              <p><strong>{lesson ? `${new Date(lesson.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(lesson.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Choose a time that works for you'}</strong></p>
              <p>Instructor: {instructor}</p>
              <p>{lesson?.notes || 'Book your next driving lesson from this portal.'}</p>
            </div>
            <div className="lesson-actions">
              <button className="book-button" type="button" onClick={() => setSelectedBooking({ ...lesson, mode: 'details' })}>View details</button>
              <button className="text-button" type="button" onClick={() => setSelectedBooking({ ...lesson, mode: 'reschedule' })}>Reschedule</button>
            </div>
            {selectedBooking && (
              <div className="booking-dialog">
                <div className="panel-heading">
                  <div><p className="eyebrow">{selectedBooking.mode === 'details' ? 'LESSON DETAILS' : 'RESCHEDULE LESSON'}</p><h2>{selectedBooking.lesson_type}</h2></div>
                  <button className="dialog-close" type="button" onClick={() => setSelectedBooking(null)} aria-label="Close lesson dialog">×</button>
                </div>
                {selectedBooking.mode === 'details' ? (
                  <div className="lesson-detail-list">
                    <p><strong>Date:</strong> {new Date(selectedBooking.starts_at).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> {new Date(selectedBooking.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(selectedBooking.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p><strong>Instructor:</strong> {selectedBooking.instructor_name}</p>
                    <p><strong>Status:</strong> {selectedBooking.status}</p>
                    <p>{selectedBooking.notes || 'No additional notes for this lesson.'}</p>
                  </div>
                ) : (
                  <form className="reschedule-form" onSubmit={submitReschedule}>
                    <label htmlFor="reschedule-date">New date</label>
                    <input id="reschedule-date" type="date" min={new Date().toISOString().slice(0, 10)} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} required />
                    <label htmlFor="reschedule-time">New start time</label>
                    <input id="reschedule-time" type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} required />
                    <button className="book-button" type="submit" disabled={bookingLoading}>{bookingLoading ? 'Saving...' : 'Save new time'}</button>
                  </form>
                )}
              </div>
            )}
          </section>

          <section className="dashboard-panel progress-panel" id="progress">
            <div className="panel-heading"><div><p className="eyebrow">YOUR PROGRESS</p><h2>Keep moving forward</h2></div><strong className="progress-value">{progressPercent}%</strong></div>
            <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            <ul className="milestones">
              <li className="complete">✓ Vehicle safety checks</li>
              <li className="complete">✓ Moving off and stopping</li>
              <li className="complete">✓ Junctions and roundabouts</li>
              <li>○ Independent driving</li>
            </ul>
            <button className="text-button" type="button" onClick={() => showAction('Your progress is calculated from completed bookings in PostgreSQL.', 'progress')}>View full progress →</button>
          </section>
        </div>

        <div className="dashboard-grid lower-grid">
          <section className="dashboard-panel instructor-panel">
            <div className="panel-heading"><div><p className="eyebrow">INSTRUCTOR</p><h2>{instructor}</h2></div><span className="avatar">{instructor.slice(0, 2).toUpperCase()}</span></div>
            <p className="muted">{lesson?.instructor_bio || 'Your instructor details will appear when a lesson is booked.'}</p>
            <div className="instructor-actions">            <button className="book-button" type="button" onClick={() => setActivePanel('message')}>Message instructor</button><button className="text-button" type="button" onClick={() => setActivePanel('instructor')}>View profile</button></div>
          </section>
          <section className="dashboard-panel" id="payments">
            <div className="panel-heading"><div><p className="eyebrow">PAYMENTS</p><h2>Paid to date</h2></div><strong>£{(balance / 100).toFixed(2)}</strong></div>
            <p className="muted">{overview.payments.length ? `${overview.payments.length} payment record(s)` : 'No payments recorded yet.'}</p>
            <button className="text-button" type="button" onClick={() => setActivePanel('payments')}>View payment history →</button>
          </section>
        </div>

        <section className="dashboard-panel history-panel" id="history">
          <div className="panel-heading"><div><p className="eyebrow">RECENT LESSONS</p><h2>Lesson history</h2></div><button className="text-button" type="button" onClick={() => setActivePanel('history')}>See all →</button></div>
          {overview.bookings.filter((booking) => booking.status === 'completed').map((booking) => (
            <div className="history-row" key={booking.id}><span className="history-date">{new Date(booking.starts_at).toLocaleDateString()}</span><strong>{booking.lesson_type}</strong><span className="history-instructor">with {booking.instructor_name}</span><span className="completed">Completed</span></div>
          ))}
          {!overview.bookings.some((booking) => booking.status === 'completed') && <p className="muted">Your completed lessons will appear here.</p>}
        </section>
        <section className="notification-strip">
          <div className="notification-bell">!</div>
          <div><strong>{overview.notifications.length ? overview.notifications[0].title : 'You are all set'}</strong><p>{overview.notifications.length ? overview.notifications[0].message : 'Your FirstGear account is up to date. We will notify you about upcoming lessons.'}</p></div>
          <button className="text-button" type="button" onClick={() => setActivePanel('notifications')}>View notifications →</button>
        </section>
        {activePanel && (
          <section className={['message', 'instructor'].includes(activePanel) ? 'dialog-backdrop' : ''} onMouseDown={(event) => {
            if (['message', 'instructor'].includes(activePanel) && event.target === event.currentTarget) setActivePanel(null);
          }}>
          <section className={`dashboard-panel detail-view${['message', 'instructor'].includes(activePanel) ? ' message-dialog' : ''}`} role={['message', 'instructor'].includes(activePanel) ? 'dialog' : undefined} aria-modal={['message', 'instructor'].includes(activePanel) ? 'true' : undefined} aria-live="polite">
            <div className="panel-heading">
              <div><p className="eyebrow">FIRSTGEAR</p><h2>
                {activePanel === 'message' && `Message ${instructor}`}
                {activePanel === 'instructor' && 'Instructor profile'}
                {activePanel === 'payments' && 'Payment history'}
                {activePanel === 'history' && 'All lesson history'}
                {activePanel === 'notifications' && 'Notifications'}
              </h2></div>
              <button className="dialog-close" type="button" onClick={() => setActivePanel(null)} aria-label="Close panel">×</button>
            </div>
            {activePanel === 'message' && (
              <form className="message-form" onSubmit={(event) => { event.preventDefault(); setActionMessage(`Message sent to ${instructor}.`); setActivePanel(null); }}>
                <p className="muted">Ask a question about your next lesson or let your instructor know what you need.</p>
                <textarea aria-label="Message to instructor" placeholder={`Message ${instructor}`} required />
                <button className="book-button" type="submit">Send message</button>
              </form>
            )}
            {activePanel === 'instructor' && <div className="profile-detail"><span className="large-avatar">{instructor.slice(0, 2).toUpperCase()}</span><h3>{instructor}</h3><p>{lesson?.instructor_bio || 'Experienced FirstGear driving instructor.'}</p><p className="muted">Assigned to your upcoming lessons.</p><button className="book-button" type="button" onClick={() => setActivePanel('message')}>Message {instructor}</button></div>}
            {activePanel === 'payments' && <div className="detail-list">{overview.payments.length ? overview.payments.map((payment) => <div className="detail-row" key={payment.id}><span>{new Date(payment.created_at).toLocaleDateString()}</span><strong>£{(payment.amount_cents / 100).toFixed(2)}</strong><span className="status-pill">{payment.status}</span></div>) : <p className="muted">No payment history yet.</p>}</div>}
            {activePanel === 'history' && <div className="detail-list">{overview.bookings.length ? overview.bookings.map((booking) => <div className="detail-row" key={booking.id}><span>{new Date(booking.starts_at).toLocaleDateString()}</span><strong>{booking.lesson_type}</strong><span className="status-pill">{booking.status}</span></div>) : <p className="muted">No lesson history yet.</p>}</div>}
            {activePanel === 'notifications' && <div className="detail-list">{overview.notifications.length ? overview.notifications.map((notification) => <div className="notification-item" key={notification.id}><strong>{notification.title}</strong><p>{notification.message}</p><span>{new Date(notification.created_at).toLocaleDateString()}</span></div>) : <p className="muted">You have no notifications.</p>}</div>}
          </section>
          </section>
        )}
          </>
        )}

        {activeTab === 'book' && (
          <section className="app-view" aria-labelledby="book-view-title">
            <p className="eyebrow">BOOKING</p>
            <h1 id="book-view-title">Book a driving lesson</h1>
            <p className="view-intro">Choose the lesson you want and we’ll help arrange a time with your instructor.</p>
            <div className="booking-options">
              {[
                { id: 1, name: 'Behind-the-wheel', description: 'Practical driving instruction', duration_minutes: 60, price_cents: 6500 },
                { id: 2, name: 'Road test preparation', description: 'Focused preparation for your driving test', duration_minutes: 90, price_cents: 9000 },
              ].map((lesson) => (
                <article className="booking-option" key={lesson.id}>
                  <div>
                    <p className="eyebrow">{lesson.id === 1 ? 'POPULAR' : 'TEST READY'}</p>
                    <h2>{lesson.name}</h2>
                    <p>{lesson.description} · {lesson.duration_minutes} minutes</p>
                  </div>
                  <strong>£{lesson.price_cents / 100}</strong>
                  <button className="book-button" type="button" onClick={() => setSelectedLesson(lesson)}>Choose lesson</button>
                </article>
              ))}
            </div>
            {selectedLesson && (
              <form className="booking-form" onSubmit={submitBooking}>
                <p className="eyebrow">CONFIRM YOUR BOOKING</p>
                <h2>{selectedLesson.name}</h2>
                <label htmlFor="booking-date">Date</label>
                <input id="booking-date" type="date" value={bookingDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setBookingDate(event.target.value)} required />
                <label htmlFor="booking-time">Start time</label>
                <input id="booking-time" type="time" value={bookingTime} onChange={(event) => setBookingTime(event.target.value)} required />
                <div className="booking-form-actions">
                  <button className="book-button" type="submit" disabled={bookingLoading}>{bookingLoading ? 'Booking...' : 'Confirm booking'}</button>
                  <button className="text-button" type="button" onClick={() => setSelectedLesson(null)}>Cancel</button>
                </div>
              </form>
            )}
            {actionMessage && <div className="action-message" role="status">{actionMessage}<button type="button" onClick={() => setActionMessage('')}>×</button></div>}
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="app-view" aria-labelledby="activity-view-title">
            <p className="eyebrow">ACTIVITY</p>
            <h1 id="activity-view-title">Your lessons</h1>
            <p className="view-intro">Track upcoming and completed lessons in one place.</p>
            <div className="activity-list">
              {overview.bookings.map((booking) => (
                <article className="activity-item" key={booking.id}>
                  <div className="activity-date">{new Date(booking.starts_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</div>
                  <div><h2>{booking.lesson_type}</h2><p>{booking.instructor_name} · {new Date(booking.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div>
                  <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
                </article>
              ))}
              {!overview.bookings.length && <p className="muted">No lessons booked yet.</p>}
            </div>
          </section>
        )}

        {activeTab === 'account' && (
          <section className="app-view" aria-labelledby="account-view-title">
            <p className="eyebrow">ACCOUNT</p>
            <h1 id="account-view-title">Your account</h1>
            <p className="view-intro">Manage your FirstGear profile and get support.</p>
            <div className="account-card">
              <div className="large-avatar">S</div>
              <div><h2>{overview.profile?.display_name || 'Student'}</h2><p>{contact}</p></div>
            </div>
            <div className="account-links">
              <button type="button" onClick={() => showAction('Your inbox is up to date.')}>Inbox <span>›</span></button>
              <button type="button" onClick={() => showAction('Wallet and payment history are available from your account.')}>Wallet <span>›</span></button>
              <button type="button" onClick={() => showAction('FirstGear help is available from the support centre.')}>Help <span>›</span></button>
              <button type="button" onClick={() => showAction('Safety guidance and driving support are available here.')}>Safety <span>›</span></button>
              <button type="button" onClick={onSignOut}>Sign out <span>›</span></button>
            </div>
            <section className="dashboard-panel instructor-application">
              <p className="eyebrow">BECOME AN INSTRUCTOR</p>
              <h2>Apply to teach with FirstGear</h2>
              <p className="muted">Submit your details for superadmin approval before accepting student bookings.</p>
              <form className="profile-form" onSubmit={submitInstructorApplication}>
                <label htmlFor="application-name">Full name</label>
                <input id="application-name" value={instructorApplication.display_name} onChange={(event) => setInstructorApplication({ ...instructorApplication, display_name: event.target.value })} required />
                <label htmlFor="application-phone">Phone number</label>
                <input id="application-phone" type="tel" value={instructorApplication.phone} onChange={(event) => setInstructorApplication({ ...instructorApplication, phone: event.target.value })} />
                <label htmlFor="application-license">Driving licence / ADI number</label>
                <input id="application-license" value={instructorApplication.license_number} onChange={(event) => setInstructorApplication({ ...instructorApplication, license_number: event.target.value })} required />
                <label htmlFor="application-bio">About your experience</label>
                <textarea id="application-bio" rows="3" value={instructorApplication.bio} onChange={(event) => setInstructorApplication({ ...instructorApplication, bio: event.target.value })} />
                <button className="book-button" type="submit" disabled={applicationSaving}>{applicationSaving ? 'Submitting...' : 'Submit application'}</button>
                {applicationStatus && <p className={applicationStatus.startsWith('Application') ? 'form-success' : 'form-error'} role="status">{applicationStatus}</p>}
              </form>
            </section>
            {actionMessage && <div className="action-message" role="status">{actionMessage}<button type="button" onClick={() => setActionMessage('')}>×</button></div>}
          </section>
        )}
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={activeTab === 'home' ? 'active' : ''} type="button" onClick={() => selectTab('home')}>
          <span className="nav-icon">⌂</span><span>Home</span>
        </button>
        <button className={activeTab === 'book' ? 'active' : ''} type="button" onClick={() => selectTab('book')}>
          <span className="nav-icon">＋</span><span>Book</span>
        </button>
        <button className={activeTab === 'activity' ? 'active' : ''} type="button" onClick={() => selectTab('activity')}>
          <span className="nav-icon">↗</span><span>Activity</span>
        </button>
        <button className={activeTab === 'account' ? 'active' : ''} type="button" onClick={() => selectTab('account')}>
          <span className="nav-icon">●</span><span>Account</span>
        </button>
      </nav>
    </main>
  );
}
