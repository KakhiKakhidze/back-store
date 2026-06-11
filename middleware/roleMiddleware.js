export const requireRoles = (roles) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    
    if (!userRole) {
      return res.status(401).json({ error: "Unauthorized: No user role provided" });
    }

    if (roles.includes(userRole) || userRole === 'GM') {
      next();
    } else {
      res.status(403).json({ error: "Forbidden: You do not have permission to access this resource" });
    }
  };
};
