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
    const savedTime = localStorage.getItem(LOGIN_KEY);
    const now = Date.now();

    firebase.auth().onAuthStateChanged(user => {
        if (user && savedTime) {
            const diffMins = (now - parseInt(savedTime)) / (1000 * 60);
            if (diffMins <= LOGIN_EXPIRY_MINUTES) {
                document.getElementById("loginSection").classList.add("hidden");
                document.getElementById("dashboard").classList.remove("hidden");
                startAttendanceListener();
                loadFeedbacks();
                startAnnouncementListener(); // ← ADD THIS LINE HERE
            } else {
                localStorage.removeItem(LOGIN_KEY);
                firebase.auth().signOut();
            }
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

function login() {
    const emailVal = email.value.trim();
    const passwordVal = password.value.trim();
    if (!emailVal || !passwordVal) return;

    firebase.auth().signInWithEmailAndPassword(emailVal, passwordVal)
        .then(() => {
            localStorage.setItem(LOGIN_KEY, Date.now().toString());
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
                loadAnnouncement(); // 👈 here
            }, 2000);

        })
        .catch(() => {
            showNotification("Wrong password or email");
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

    feedbackRef.once("value", (snapshot) => {
        allFeedbacks = [];

        snapshot.forEach((childSnap) => {
            const fb = childSnap.val();
            if (fb.date) {
                // Combine date+time if needed for sorting
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
    });

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
