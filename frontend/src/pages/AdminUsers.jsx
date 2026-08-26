import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../utils/api';
import Footer from '../components/Footer';
import '../styles/admin-users.css';
import { Ban, Banknote, CircleCheck } from 'lucide-react';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await adminAPI.getAllUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId) => {
    if (window.confirm('Are you sure you want to suspend this user?')) {
      try {
        await adminAPI.suspendUser({ userId });
        fetchUsers();
      } catch (err) {
        setError('Failed to suspend user');
      }
    }
  };

  const handleUnsuspend = async (userId) => {
    if (window.confirm('Are you sure you want to unsuspend this user?')) {
      try {
        await adminAPI.unsuspendUser({ userId });
        fetchUsers();
      } catch (err) {
        setError('Failed to unsuspend user');
      }
    }
  };

  // Apply role filter first, then apply search by name or phone
  const q = query.trim().toLowerCase();
  let filteredUsers = filter === 'all' ? users : users.filter(u => u.role === filter);
  if (q) {
    filteredUsers = filteredUsers.filter(u => {
      const name = (u.name || '').toLowerCase();
      const phone = (u.phone || '');
      return name.includes(q) || phone.includes(q);
    });
  }

  return (
    <>
    <div className="admin-page">
      <div className="page-header">
        <h1>Manage Users</h1>
        <p>View and manage all system users</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-header flex-between">
          <h3>Users ({filteredUsers.length})</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="search"
              className="search-input"
              placeholder="Search name or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search users by name or phone"
            />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Users</option>
              <option value="user">Users</option>
              <option value="agent">Agents</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <p className="text-center">Loading users...</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td><span className="badge badge-primary">{user.role}</span></td>
                      <td>SSP {(parseFloat(user?.balance) || 0).toFixed(2)}</td>
                      <td>
                        {user.isSuspended ? (
                          <span className="badge badge-danger">Suspended</span>
                        ) : (
                          <span className="badge badge-success">Active</span>
                        )}
                      </td>
                      <td>
                        <div className="action-icons">
                          <button 
                            className="icon-btn"
                            onClick={() => navigate('/admin/topup', { state: { phone: user.phone } })}
                            title="Topup"
                          >
                            <Banknote size={18} />
                          </button>
                          {user.isSuspended ? (
                            <button 
                              className="icon-btn"
                              onClick={() => handleUnsuspend(user.id)}
                              title="Unsuspend"
                            >
                              <CircleCheck size={18} />
                            </button>
                          ) : (
                            <button 
                              className="icon-btn"
                              onClick={() => handleSuspend(user.id)}
                              title="Suspend"
                            >
                              <Ban size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
