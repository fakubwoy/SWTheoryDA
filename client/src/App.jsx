import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [myNumber, setMyNumber] = useState('');
  const [name, setName] = useState('');
  const [profile, setProfile] = useState({});
  const [contacts, setContacts] = useState({});
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState({});
  const [groupMessages, setGroupMessages] = useState({});
  const [groups, setGroups] = useState([]);
  const [input, setInput] = useState('');
  const [view, setView] = useState('contacts');
  const [onlineStatus, setOnlineStatus] = useState({});
  const [isLoading, setIsLoading] = useState(true);

const numberToName = {
  '8888888888': 'Aditya',
  '9999999999': 'Farhaan',
  '7777777777': 'Harrshini'
};
  useEffect(() => {
    socket.on('contact_list', (contactList) => {
      setContacts(contactList);
      setIsLoading(false);

    });

    socket.on('user_profile', (userProfile) => {
      setProfile(userProfile);
    });

    socket.on('receive_message', (msg) => {
      setMessages(prev => {
        const currentMessages = prev[msg.from] || [];
        if (!currentMessages.some(m => m.id === msg.id)) {
          const updatedMessages = [...currentMessages, msg];
          if (selectedContact === msg.from) {
            socket.emit('seen', { 
              from: msg.from, 
              to: myNumber, 
              messageIds: [msg.id] 
            });
          }
          return {
            ...prev,
            [msg.from]: updatedMessages
          };
        }
        return prev;
      });
    });

    socket.on('message_sent_confirmation', ({ id, to, status }) => {
      setMessages(prev => {
        const updatedMessages = { ...prev };
        if (updatedMessages[to]) {
          updatedMessages[to] = updatedMessages[to].map(msg => 
            msg.id === id ? { ...msg, status } : msg
          );
        }
        return updatedMessages;
      });
    });

    socket.on('status_update', ({ from, status, messageIds }) => {
      setMessages(prev => {
        const updatedMessages = { ...prev };
        if (updatedMessages[from]) {
          updatedMessages[from] = updatedMessages[from].map(msg => 
            messageIds.includes(msg.id) ? { ...msg, status } : msg
          );
        }
        return updatedMessages;
      });
    });

    socket.on('new_group', (group) => {
      setGroups(prevGroups => {
        if (!prevGroups.some(g => g.id === group.id)) {
          return [...prevGroups, group];
        }
        return prevGroups;
      });
    });

    socket.on('receive_group_message', ({ groupId, message }) => {
      setGroupMessages(prev => {
        const currentGroupMessages = prev[groupId] || [];
        return {
          ...prev,
          [groupId]: [...currentGroupMessages, message]
        };
      });
    });

    socket.on('profile_updated', (updatedProfile) => {
      setProfile(updatedProfile);
    });

    socket.on('contact_online', ({ phone, status }) => {
      setOnlineStatus(prev => ({
        ...prev,
        [phone]: { status, lastSeen: null }
      }));
    });

    socket.on('contact_offline', ({ phone, lastSeen }) => {
      setOnlineStatus(prev => ({
        ...prev,
        [phone]: { status: 'Offline', lastSeen }
      }));
    });

    return () => {
      socket.off('contact_list');
      socket.off('user_profile');
      socket.off('receive_message');
      socket.off('message_sent_confirmation');
      socket.off('status_update');
      socket.off('new_group');
      socket.off('receive_group_message');
      socket.off('profile_updated');
      socket.off('contact_online');
      socket.off('contact_offline');
    };
  }, [myNumber, selectedContact]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (phone) => {
    if (!phone) return '';
    const status = onlineStatus[phone];
    if (!status) return 'Last seen recently';
    
    if (status.status === 'Online') return 'Online';
    if (status.lastSeen) {
      return `Last seen at ${formatTime(status.lastSeen)}`;
    }
    return 'Last seen recently';
  };

  const register = () => {
    socket.emit('register', myNumber);
    const userNames = {
      '8888888888': 'Farhaan',
      '9999999999': 'Aditya',
      '7777777777': 'Meera'
    };
    setName(userNames[myNumber]);
  };

  const sendMessage = () => {
    if (!input.trim()) return;

    const msg = { 
      from: myNumber, 
      to: selectedContact, 
      message: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => {
      const currentMessages = prev[selectedContact] || [];
      return {
        ...prev,
        [selectedContact]: [...currentMessages, {
          ...msg,
          status: 'Sending'
        }]
      };
    });
    
    socket.emit('send_message', msg);
    setInput('');
  };

  const createGroup = () => {
    const groupName = prompt("Enter group name:");
    if (groupName) {
      const selectedMembers = Object.keys(contacts).filter(contact => 
        confirm(`Add ${contacts[contact].name} to the group?`)
      );
      
      const membersToAdd = [...new Set([...selectedMembers, myNumber])];
      
      socket.emit('create_group_chat', {
        name: groupName,
        members: membersToAdd,
        admin: myNumber
      });
    }
  };

  const updateProfile = () => {
    const newName = prompt("Enter new name:", profile.name);
    const newAbout = prompt("Enter new about:", profile.about);
    const newProfilePic = prompt("Enter new profile picture URL:", profile.profilePic);
    
    const updates = {};
    if (newName) updates.name = newName;
    if (newAbout) updates.about = newAbout;
    if (newProfilePic) updates.profilePic = newProfilePic;

    if (Object.keys(updates).length > 0) {
      socket.emit('update_profile', {
        phone: myNumber,
        updates
      });
    }
  };

  const renderView = () => {
    if (isLoading) return <div className="loading">Loading...</div>;

    switch(view) {
      case 'contacts':
      return (
        <div className="chat-list">
          <h3 style={{ margin: '20px' }}>Select a contact:</h3>
          {Object.keys(contacts).map((num) => {
            const contactName = numberToName[num] || num; 
            return (
              <div
                key={num}
                className="contact-item"
                onClick={() => {
                  setSelectedContact(num);
                  setSelectedGroup(null);
                }}
              >
                <div className="contact-avatar">
                  <img 
                    src="/home/fakubwoy/reactapps/what/client/src/pfp.webp"  
                    className="profile-pic"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/home/fakubwoy/reactapps/what/client/src/pfp.webp';
                    }}
                  />
                </div>
                <div className="contact-info">
                  <span className="contact-name">{contactName}</span>
                  <span className="last-seen">{formatLastSeen(num)}</span>
                </div>
              </div>
            );
          })}
          <button onClick={createGroup} className="create-group-btn">Create Group</button>
        </div>
      );
      case 'groups':
        return (
          <div className="chat-list">
            <h3 style={{ margin: '20px' }}>Groups:</h3>
            {groups.map(group => (
              <div
                key={group.id}
                className="contact-item"
                onClick={() => {
                  setSelectedGroup(group);
                  setSelectedContact('');
                }}
              >
                <div className="contact-avatar">
                  <img 
                    src="group-pfp.webp" 
                    className="profile-pic"
                  />
                </div>
                <div className="contact-info">
                  <span className="contact-name">{group.name}</span>
                  <span className="group-members">
                    {group.members.map(m => contacts[m]?.name || m).join(', ')}
                  </span>
                </div>
              </div>
            ))}
            <button onClick={createGroup} className="create-group-btn">Create Group</button>
          </div>
        );
      case 'profile':
        return (
          <div className="profile-box">
            <div className="profile-header">
              <img 
                src={profile.profilePic || 'pfp.webp'} 
                className="profile-picture-large"
              />
              <h3>{profile.name}</h3>
              <p className="profile-about">{profile.about}</p>
            </div>
            <button onClick={updateProfile} className="edit-profile-btn">Edit Profile</button>
          </div>
        );
      default:
        return null;
    }
  };

  const renderChats = () => {
    if (selectedGroup) {
      const currentGroupChat = groupMessages[selectedGroup.id] || [];
      return (
        <div className="chat-messages">
          {currentGroupChat.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble ${msg.from === myNumber ? 'sent' : 'received'}`}
            >
              {msg.from !== myNumber && (
                <div className="message-sender">
                  {contacts[msg.from]?.name || msg.from}
                </div>
              )}
              <div className="message-content">{msg.message}</div>
              <div className="message-time-status">
                <span className="timestamp">{formatTime(msg.timestamp)}</span>
                {msg.from === myNumber && (
                  <span className="status">
                    {msg.status === 'Sending' && '🕒'}
                    {msg.status === 'Delivered' && '✓'}
                    {msg.status === 'Seen' && '✓✓'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
  
    if (selectedContact) {
      const currentChat = messages[selectedContact] || [];
      return (
        <div className="chat-messages">
          {currentChat.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble ${msg.from === myNumber ? 'sent' : 'received'}`}
            >
              <div className="message-content">{msg.message}</div>
              <div className="message-time-status">
                <span className="timestamp">{formatTime(msg.timestamp)}</span>
                {msg.from === myNumber && (
                  <span className="status">
                    {msg.status === 'Sending' && '✓✓'}
                    {msg.status === 'Delivered' && '✓'}
                    {msg.status === 'Seen' && '✓✓'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderInputArea = () => {
    if (selectedContact || selectedGroup) {
      return (
        <div className="input-area">
          <input
            className="input"
            placeholder="Type a message"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                if (selectedContact) {
                  sendMessage();
                } else if (selectedGroup) {
                  socket.emit('send_group_message', { 
                    groupId: selectedGroup.id, 
                    from: myNumber, 
                    message: input 
                  });
                  setInput('');
                }
              }
            }}
          />
          <button 
            className="button" 
            onClick={() => {
              if (selectedContact) {
                sendMessage();
              } else if (selectedGroup) {
                socket.emit('send_group_message', { 
                  groupId: selectedGroup.id, 
                  from: myNumber, 
                  message: input 
                });
                setInput('');
              }
            }}
          >
            Send
          </button>
        </div>
      );
    }
    return null;
  };

  const renderChatHeader = () => {
    if (selectedContact || selectedGroup) {
      const contactName = selectedContact ? numberToName[selectedContact] || selectedContact : '';
      return (
        <div className="chat-header">
          <button className="whatsapp-back-button" onClick={() => {
            setSelectedContact('');
            setSelectedGroup(null);
          }}>
            <svg viewBox="0 0 24 24" width="24" height="24" className="back-arrow">
              <path fill="currentColor" d="M12 4l1.4 1.4L7.8 11H20v2H7.8l5.6 5.6L12 20l-8-8 8-8z"></path>
            </svg>
          </button>
          {selectedContact ? (
            <>
              <img 
                src="/pfp.webp" 
                alt={contactName}
                className="chat-header-avatar"
              />
              <div className="chat-header-info">
                <span className="chat-title">{contactName}</span>
                <span className="chat-status">{formatLastSeen(selectedContact)}</span>
              </div>
            </>
          ) : (
            <>
              <img 
                src="pfp.webp" 
                alt={selectedGroup.name}
                className="chat-header-avatar"
              />
              <div className="chat-header-info">
                <span className="chat-title">{selectedGroup.name}</span>
                <span className="chat-status">
                  {selectedGroup.members.length} members
                </span>
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  if (!name) {
    return (
      <div className="container">
        <div className="login-box">
          <h2>WhatsApp Clone</h2>
          <input 
            type="tel"
            placeholder="Enter your number" 
            value={myNumber} 
            onChange={e => setMyNumber(e.target.value)} 
          />
          <button onClick={register}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="header">
        <div className="nav-buttons">
          <button 
            className={view === 'contacts' ? 'active' : ''}
            onClick={() => setView('contacts')}
          >
            Contacts
          </button>
          <button 
            className={view === 'groups' ? 'active' : ''}
            onClick={() => setView('groups')}
          >
            Groups
          </button>
          <button 
            className={view === 'profile' ? 'active' : ''}
            onClick={() => setView('profile')}
          >
            Profile
          </button>
        </div>
      </div>
      
      <div className="chat-container">
        <div className="sidebar">
          {renderView()}
        </div>
        
        {(selectedContact || selectedGroup) && (
          <div className="chat-panel">
            {renderChatHeader()}
            {renderChats()}
            {renderInputArea()}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;