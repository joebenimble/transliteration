function createAuthMiddleware(appPassword) {
  function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
      return next();
    }

    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    return res.redirect('/login.html');
  }

  function handleLogin(req, res) {
    const { password } = req.body;

    if (!appPassword) {
      return res.status(500).send('APP_PASSWORD is not configured');
    }

    if (password === appPassword) {
      req.session.authenticated = true;
      return req.session.save((err) => {
        if (err) {
          console.error('Failed to save session:', err);
          return res.status(500).send('Session error');
        }
        return res.redirect('/');
      });
    }

    return res.redirect('/login.html?error=1');
  }

  function handleLogout(req, res) {
    req.session.destroy(() => {
      res.redirect('/login.html');
    });
  }

  return { requireAuth, handleLogin, handleLogout };
}

module.exports = { createAuthMiddleware };
