const firebaseConfig = {
    apiKey: "AIzaSyByxIQKLvLfKATJicWtacdTJG8nb5hsVCI",
    authDomain: "realtime-database-7e415.firebaseapp.com",
    databaseURL: "https://realtime-database-7e415-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "realtime-database-7e415",
    storageBucket: "realtime-database-7e415.appspot.com",
    messagingSenderId: "817516970962",
    appId: "1:817516970962:web:YOUR_APP_ID_IF_AVAILABLE"
};
firebase.initializeApp(firebaseConfig);

const email = document.getElementById("email");
const password = document.getElementById("password");
const notification = document.getElementById("notification");
const LOGIN_EXPIRY_MINUTES = 30;
const LOGIN_KEY = 'lastLoginTime';

// Define all strands / courses
const STRANDS = [
    "CA - Culinary Arts",
    "GAS - General Academic",
    "HUMSS - Humanities and Social Sciences",
    "ITMAWD - IT in Mobile App and Web Development",
    "STEM - Science, Technology, Engineering, and Mathematics",
    "TO - Tourism Operations",
    "BSHM - Bachelor of Science in Hospitality Management",
    "BSCPE - Bachelor of Science in Computer Engineering",
    "BSIT - Bachelor of Science in Information Technology"
];

function renderStatistics(filteredStudents) {
    const gradeGrid = document.getElementById("gradeStatsGrid");
    const strandGrid = document.getElementById("strandStatsGrid");

    // clear before render
    gradeGrid.innerHTML = "";
    strandGrid.innerHTML = "";

    // initialize counts
    const strandCounts = {};
    STRANDS.forEach(strand => strandCounts[strand] = 0);

    const gradeCounts = { "G11": 0, "G12": 0, "College": 0 };

    // count students
    filteredStudents.forEach(({ data }) => {
        // Count by strand
        if (strandCounts.hasOwnProperty(data.strand)) {
            strandCounts[data.strand]++;
        }

        // Count by grade level (normalize input)
        if (data.grade) {
            const g = data.grade.toString().toLowerCase();

            if (g.includes("11")) {
                gradeCounts["G11"]++;
            } else if (g.includes("12")) {
                gradeCounts["G12"]++;
            } else if (
                g.includes("1st") || g.includes("first") ||
                g.includes("2nd") || g.includes("second") ||
                g.includes("3rd") || g.includes("third") ||
                g.includes("4th") || g.includes("fourth")
            ) {
                gradeCounts["College"]++;
            }
        }
    });

    // total students card (goes on top with grades)
    const total = filteredStudents.length;
    const totalCard = document.createElement("div");
    totalCard.className = "stat-card";
    totalCard.innerHTML = `
    <div class="stat-number">${total}</div>
    <div class="stat-label">Total Students</div>
  `;
    gradeGrid.appendChild(totalCard);

    // Grade-level summary cards
    Object.keys(gradeCounts).forEach(level => {
        const count = gradeCounts[level];
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
        const card = document.createElement("div");
        card.className = "stat-card grade-card";
        card.innerHTML = `
      <div class="stat-number">${count}</div>
      <div class="stat-label">${level} (${percent})</div>
    `;
        gradeGrid.appendChild(card);
    });

    // Strand summary cards (below)
    STRANDS.forEach(strand => {
        const count = strandCounts[strand];
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%";
        const card = document.createElement("div");
        card.className = "stat-card";
        card.innerHTML = `
      <div class="stat-number">${count}</div>
      <div class="stat-label">${strand} (${percent})</div>
    `;
        strandGrid.appendChild(card);
    });
}


function startAnnouncementListener() {
    const ref = firebase.database().ref("Announcement-To-Librarian/Announcement");

    ref.off(); // remove any existing listener just to be safe

    ref.on("value", (snapshot) => {
        const data = snapshot.val();
        console.log("📢 Live announcement update:", data);
        if (data) {
            document.getElementById("announceName").textContent = data.name || "N/A";
            document.getElementById("announceRole").textContent = data.role || "N/A";
            document.getElementById("announceDesc").textContent = data.description || "No description.";
            document.getElementById("announcementCard").classList.remove("hidden");
        } else {
            document.getElementById("announcementCard").classList.add("hidden");
        }
    }, (error) => {
        console.error("🔥 Error listening to announcement:", error);
    });
}


document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(user => {
    const savedTime = localStorage.getItem(LOGIN_KEY);
    const now = Date.now();

    if (user && savedTime) {
      const diffMins = (now - parseInt(savedTime)) / (1000 * 60);

      if (diffMins <= LOGIN_EXPIRY_MINUTES) {
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");

        startAttendanceListener();
        loadFeedbacks();
        startAnnouncementListener();
      } else {
        localStorage.removeItem(LOGIN_KEY);
        firebase.auth().signOut();
        document.getElementById("loginSection").classList.remove("hidden");
        document.getElementById("dashboard").classList.add("hidden");
      }
    } else {
      document.getElementById("loginSection").classList.remove("hidden");
      document.getElementById("dashboard").classList.add("hidden");
    }
  });
});


function showNotification(msg) {
    notification.textContent = msg;
    notification.classList.add("show");
    setTimeout(() => {
        notification.classList.remove("show");
    }, 3000);
}

// Handle Enter and ArrowDown
email.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        if (!email.value.trim()) {
            showNotification("Please fill up the form");
            return;
        }
        password.focus();
    }
});

password.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        if (!password.value.trim() || !email.value.trim()) {
            showNotification("Please fill up the form");
            return;
        }
        login();
    }
});

let loginAttempts = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 0;
const LOCKOUT_KEY = "lockoutTime";
const LOGIN_KEY2 = "loginTime";

// ⏳ Check lockout on page load
document.addEventListener("DOMContentLoaded", () => {
    const lockoutTime = localStorage.getItem(LOCKOUT_KEY);
    if (lockoutTime) {
        const now = Date.now();
        const diffMins = (now - parseInt(lockoutTime)) / (1000 * 60);
        if (diffMins < LOCKOUT_MINUTES) {
            lockInputs();
            startLockoutCountdown(LOCKOUT_MINUTES - diffMins);
        } else {
            localStorage.removeItem(LOCKOUT_KEY);
            loginAttempts = 0;
            unlockInputs();
        }
    }
});

// 🔒 Lock inputs
function lockInputs() {
    email.disabled = true;
    password.disabled = true;
    email.style.backgroundColor = "#ddd";
    password.style.backgroundColor = "#ddd";
}

// 🔓 Unlock inputs
function unlockInputs() {
    email.disabled = false;
    password.disabled = false;
    email.style.backgroundColor = "";
    password.style.backgroundColor = "";
}

// ⏳ Show countdown
function startLockoutCountdown(minutesLeft) {
    let remaining = Math.ceil(minutesLeft * 60); // seconds
    lockInputs();

    const interval = setInterval(() => {
        if (remaining <= 0) {
            clearInterval(interval);
            unlockInputs();
            loginAttempts = 0;
            localStorage.removeItem(LOCKOUT_KEY);
            showNotification("You can try logging in again.");
            return;
        }
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        showNotification(`Locked. Try again in ${mins}m ${secs}s.`);
        remaining--;
    }, 1000);
}

// 🟢 Main login
function login() {
    const emailVal = email.value.trim();
    const passwordVal = password.value.trim();

    if (!emailVal || !passwordVal) {
        showNotification("Please fill up the form");
        return;
    }

    // If locked
    const lockoutTime = localStorage.getItem(LOCKOUT_KEY);
    if (lockoutTime) {
        const now = Date.now();
        const diffMins = (now - parseInt(lockoutTime)) / (1000 * 60);
        if (diffMins < LOCKOUT_MINUTES) {
            startLockoutCountdown(LOCKOUT_MINUTES - diffMins);
            return;
        } else {
            localStorage.removeItem(LOCKOUT_KEY);
            loginAttempts = 0;
            unlockInputs();
        }
    }

    firebase.auth().signInWithEmailAndPassword(emailVal, passwordVal)
        .then(() => {
            localStorage.setItem(LOGIN_KEY, Date.now().toString());
            loginAttempts = 0;
            unlockInputs();

            document.getElementById("loginSection").classList.add("fade-out");
            setTimeout(() => {
                document.getElementById("loginSection").classList.add("hidden");
                document.getElementById("loadingSpinner").classList.remove("hidden");
            }, 600);

            setTimeout(() => {
                document.getElementById("loadingSpinner").classList.add("hidden");
                document.getElementById("dashboard").classList.remove("hidden");
                startAttendanceListener();
                loadFeedbacks();
                startAnnouncementListener();
            }, 2000);

        })
        .catch(() => {
            loginAttempts++;
            if (loginAttempts >= MAX_ATTEMPTS) {
                localStorage.setItem(LOCKOUT_KEY, Date.now().toString());
                startLockoutCountdown(LOCKOUT_MINUTES);
            } else {
                showNotification(`Wrong password or email. Attempts left: ${MAX_ATTEMPTS - loginAttempts}`);
            }
            email.value = "";
            password.value = "";
            email.focus();
        });
}

let allStudents = [];

function startAttendanceListener() {
    const dbRef = firebase.database().ref("StudentLogs");
    dbRef.off();

    dbRef.on("value", (snapshot) => {
        const tableBody = document.querySelector("#attendanceTable tbody");
        const totalDisplay = document.getElementById("totalLoggedIn");
        tableBody.innerHTML = "";
        allStudents = [];

        snapshot.forEach((studentSnap) => {
            studentSnap.forEach((logSnap) => {
                const student = logSnap.val();
                allStudents.push({ snap: logSnap, data: student });
            });
        });

        // Sort by latest login
        allStudents.sort((a, b) => b.data.loginTime - a.data.loginTime);

        totalDisplay.textContent = `Total Logged-in Students: ${allStudents.length}`;
        renderFilteredTable(document.getElementById("searchInput").value.toLowerCase());
    });
}



document.getElementById("searchInput").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    renderFilteredTable(query);
});

let visibleCount = 6;

function renderFilteredTable(query = "") {
    const tableBody = document.querySelector("#attendanceTable tbody");
    tableBody.innerHTML = "";

    const filtered = allStudents.filter(({ data }) => {
        const { name, studentNumber, strand, grade } = data;
        const combined = `${name} ${studentNumber} ${strand} ${grade}`.toLowerCase();
        return combined.includes(query);
    });

    // Limit to visibleCount
    const toDisplay = filtered.slice(0, visibleCount);

    toDisplay.forEach(({ snap, data }) => {
        const { name, studentNumber, strand, grade, loginTime, logoutTime } = data;
        const row = tableBody.insertRow();
        row.insertCell().textContent = name || "N/A";
        row.insertCell().textContent = studentNumber || "N/A";
        row.insertCell().textContent = strand || "N/A";
        row.insertCell().textContent = grade || "N/A";
        row.insertCell().textContent = loginTime ? new Date(loginTime).toLocaleString() : "N/A";
        row.insertCell().textContent = logoutTime ? new Date(logoutTime).toLocaleString() : "—"; // 👈 NEW

        const actionCell = row.insertCell();
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.onclick = () => {
            if (confirm("Delete this session?")) {
                snap.ref.remove();
            }
        };
        actionCell.appendChild(deleteBtn);
    });


    // Toggle See More button
    const seeMoreBtn = document.getElementById("seeMoreBtn");
    if (filtered.length > 6) {
        seeMoreBtn.classList.remove("hidden");
        seeMoreBtn.textContent = attendanceExpanded ? "🔼 See Less" : "🔽 See More";
    } else {
        seeMoreBtn.classList.add("hidden");
    }

    renderStatistics(filtered);

}

let attendanceExpanded = false;

document.getElementById("seeMoreBtn")?.addEventListener("click", () => {
    attendanceExpanded = !attendanceExpanded;
    visibleCount = attendanceExpanded ? allStudents.length : 6;
    renderFilteredTable(document.getElementById("searchInput").value.toLowerCase());
});

let visibleFeedbackCount = 6;
let allFeedbacks = [];
let feedbackExpanded = false;

function loadFeedbacks() {
    const tableBody = document.querySelector("#feedbackTable tbody");
    tableBody.innerHTML = "";
    const feedbackRef = firebase.database().ref("Feedbacks");

    feedbackRef.off(); // 👈 prevent duplicate listeners
    feedbackRef.on("value", (snapshot) => {
        allFeedbacks = [];

        snapshot.forEach((childSnap) => {
            const fb = childSnap.val();
            fb._id = childSnap.key;   // 👈 keep the key so we can delete it
            if (fb.date) {
                fb._parsedDate = new Date(fb.date);
            }
            allFeedbacks.push(fb);
        });

        // Sort latest feedback first
        allFeedbacks.sort((a, b) => new Date(b._parsedDate) - new Date(a._parsedDate));

        renderFeedbackTable();
    });
}

function renderFeedbackTable() {
    const tableBody = document.querySelector("#feedbackTable tbody");
    tableBody.innerHTML = "";

    const toShow = allFeedbacks.slice(0, visibleFeedbackCount);

    toShow.forEach((fb) => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = fb.name || "N/A";
        row.insertCell().textContent = fb.studentNumber || "N/A";
        row.insertCell().textContent = fb.subject || "N/A";
        row.insertCell().textContent = fb.description || "No Description";
        const dateOnly = fb.date ? new Date(fb.date).toLocaleDateString() : "Unknown";
        row.insertCell().textContent = dateOnly;

        // 🗑️ Delete button
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.onclick = () => {
            if (confirm("Delete this feedback?")) {
                firebase.database().ref("Feedbacks").child(fb._id).remove();
            }
        };
        actionCell.appendChild(deleteBtn);
    });

    // Toggle See More button
    const seeMoreFeedbackBtn = document.getElementById("seeMoreFeedbackBtn");
    if (allFeedbacks.length > 6) {
        seeMoreFeedbackBtn.classList.remove("hidden");
        seeMoreFeedbackBtn.textContent = feedbackExpanded ? "🔼 See Less" : "🔽 See More";
    } else {
        seeMoreFeedbackBtn.classList.add("hidden");
    }
}

document.getElementById("seeMoreFeedbackBtn")?.addEventListener("click", () => {
    feedbackExpanded = !feedbackExpanded;
    visibleFeedbackCount = feedbackExpanded ? allFeedbacks.length : 6;
    renderFeedbackTable();
});
