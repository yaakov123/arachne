import { createUser, formatUserName, type User } from '@arachne/shared';
import { useState } from 'react';

function App() {
  const [users, setUsers] = useState<User[]>([]);

  const addUser = () => {
    const newUser = createUser(`User ${users.length + 1}`, `user${users.length + 1}@example.com`);
    setUsers([...users, newUser]);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Arachne Monorepo Demo</h1>
      <button onClick={addUser}>Add User</button>
      <div style={{ marginTop: '1rem' }}>
        {users.map((user) => (
          <div key={user.id} style={{ padding: '0.5rem', border: '1px solid #ccc', margin: '0.5rem 0' }}>
            {formatUserName(user)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;