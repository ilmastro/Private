document.addEventListener("DOMContentLoaded", () => {
  // Initialize Quill Editor
  const editor = new Quill("#editor", {
    theme: "snow",
    placeholder: "Write your journal entry here...",
    modules: {
      toolbar: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline"],
        ["blockquote", "code-block"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["clean"],
      ],
    },
  });

  const entryForm = document.getElementById("entry-form");
  const entriesDiv = document.getElementById("entries");
  const exportButton = document.getElementById("export-button");
  const fileInput = document.getElementById("file-input");
  const loadButton = document.getElementById("load-button");
  const searchInput = document.getElementById("search-input");
  const tagsInput = document.getElementById("tags-input");
  const moodSelect = document.getElementById("mood-select");
  const calendarDiv = document.getElementById("calendar");
  const analyticsDashboard = document.getElementById("analytics-dashboard");
  const entriesChartCtx = document
    .getElementById("entries-chart")
    .getContext("2d");
  const moodStatsDiv = document.getElementById("mood-stats");

  let entries = JSON.parse(localStorage.getItem("entries")) || [];
  let reminderSet = false;

  const saveEntries = () => {
    localStorage.setItem("entries", JSON.stringify(entries));
  };

  const formatDate = (date) => {
    const day = ("0" + date.getDate()).slice(-2);
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const parseDate = (dateString) => {
    const parts = dateString.split("-");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are zero-based
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  const renderEntries = (
    filterText = "",
    filterTags = [],
    filterDate = null
  ) => {
    // Convert filterText to lowercase for case-insensitive search
    const searchText = filterText.toLowerCase();

    // entriesDiv.innerHTML = ''; // Remove this line, as Sortable.js manages DOM elements

    // Keep track of dates with entries that match the search criteria
    const datesWithEntries = new Set();

    // Clear entriesDiv but preserve the event listeners
    while (entriesDiv.firstChild) {
      entriesDiv.removeChild(entriesDiv.firstChild);
    }

    entries.forEach((entry, index) => {
      // Assign a unique ID to each entry if it doesn't have one
      if (!entry.id) {
        entry.id = generateUUID();
      }

      // Convert entry content to plain text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = entry.content;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";

      // Combine content and tags for searching
      let searchableText = plainText.toLowerCase();

      // Include tags in searchable text
      if (entry.tags && entry.tags.length > 0) {
        searchableText += " " + entry.tags.join(" ").toLowerCase();
      }

      // Apply search filter
      if (searchText && !searchableText.includes(searchText)) {
        return; // Skip this entry if it doesn't match the search
      }

      // Apply date filter
      if (filterDate) {
        const entryDateStr = formatDate(new Date(entry.date));
        if (entryDateStr !== filterDate) {
          return;
        }
      }

      // Add date to the set of dates with matching entries
      datesWithEntries.add(formatDate(new Date(entry.date)));

      const entryDiv = document.createElement("div");
      entryDiv.classList.add("entry");
      entryDiv.setAttribute("data-id", entry.id);

      // Entry Header
      const entryHeader = document.createElement("div");
      entryHeader.classList.add("entry-header");

      // Mood Icon
      if (entry.mood) {
        const moodDiv = document.createElement("div");
        moodDiv.classList.add("entry-mood");
        moodDiv.textContent = getMoodIcon(entry.mood);
        entryHeader.appendChild(moodDiv);
      }

      // Entry Date
      const entryDate = document.createElement("div");
      entryDate.classList.add("entry-date");
      entryDate.textContent = formatDate(new Date(entry.date));
      entryHeader.appendChild(entryDate);

      entryDiv.appendChild(entryHeader);

      // Entry Content
      const entryContent = document.createElement("div");
      entryContent.classList.add("entry-text");
      entryContent.innerHTML = entry.content;
      entryDiv.appendChild(entryContent);

      // Tags Display
      if (entry.tags && entry.tags.length > 0) {
        const tagsDiv = document.createElement("div");
        tagsDiv.classList.add("entry-tags");
        tagsDiv.textContent = "Tags: " + entry.tags.join(", ");
        entryDiv.appendChild(tagsDiv);
      }

      const buttonsDiv = document.createElement("div");
      buttonsDiv.classList.add("entry-buttons");

      const editButton = document.createElement("button");
      editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
      editButton.setAttribute("data-tooltip", "Edit");
      editButton.addEventListener("click", () =>
        editEntry(index, entryContent, editButton)
      );

      const deleteButton = document.createElement("button");
      deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
      deleteButton.setAttribute("data-tooltip", "Delete");
      deleteButton.addEventListener("click", () => deleteEntry(index));

      buttonsDiv.appendChild(editButton);
      buttonsDiv.appendChild(deleteButton);

      entryDiv.appendChild(buttonsDiv);

      entriesDiv.appendChild(entryDiv);
    });

    // Update the calendar to only show dates with matching entries
    renderCalendar(Array.from(datesWithEntries));

    // Update analytics based on filtered entries
    updateAnalytics();
  };

  const addEntry = (
    content,
    date = new Date(),
    tags = [],
    mood = "",
    skipRender = false
  ) => {
    const newEntry = {
      content,
      date,
      tags,
      mood,
      id: generateUUID(), // Assign a unique ID when adding a new entry
    };
    entries.push(newEntry);
    if (!skipRender) {
      saveEntries();
      renderEntries();
    }
  };

  const editEntry = (index, entryContent, editButton) => {
    if (editButton.getAttribute("data-editing") !== "true") {
      // Enter edit mode
      entryContent.contentEditable = "true";
      entryContent.focus();
      editButton.innerHTML = '<i class="fas fa-save"></i>';
      editButton.setAttribute("data-tooltip", "Save");
      editButton.setAttribute("data-editing", "true");
    } else {
      // Save changes
      entries[index].content = entryContent.innerHTML;
      saveEntries();
      entryContent.contentEditable = "false";
      editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
      editButton.setAttribute("data-tooltip", "Edit");
      editButton.removeAttribute("data-editing");
      renderEntries();
    }
  };

  const deleteEntry = (index) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      entries.splice(index, 1);
      saveEntries();
      renderEntries();
    }
  };

  const exportEntries = () => {
    let content = "";
    entries.forEach((entry) => {
      content += `${formatDate(new Date(entry.date))}\n`;
      if (entry.tags && entry.tags.length > 0) {
        content += `Tags: ${entry.tags.join(", ")}\n`;
      }
      if (entry.mood) {
        content += `Mood: ${entry.mood}\n`;
      }
      // Extract plain text from HTML content
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = entry.content;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      content += `${plainText}\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal_entries.txt";
    document.body.appendChild(a); // Append to body
    a.click();
    document.body.removeChild(a); // Remove from body
    URL.revokeObjectURL(url);
  };

  const loadEntries = (files) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        parseAndAddEntries(text);
      };
      reader.readAsText(file);
    });
  };

  const parseAndAddEntries = (text) => {
    const entriesText = text.trim().split("\n");

    let currentEntry = null;

    const flushEntry = () => {
      if (currentEntry && currentEntry.text.trim()) {
        addEntry(
          currentEntry.text.trim(),
          currentEntry.date,
          currentEntry.tags,
          currentEntry.mood,
          true // Skip render and save
        );
      }
      currentEntry = null;
    };

    for (let i = 0; i < entriesText.length; i++) {
      const line = entriesText[i].trim();

      // Check for date line
      const dateMatch = line.match(/^(\d{2}-\d{2}-\d{4})$/);
      if (dateMatch) {
        // If we have an existing entry, add it
        flushEntry();

        // Start a new entry
        currentEntry = {
          date: parseDate(dateMatch[1]),
          tags: [],
          mood: "",
          text: "",
        };
      } else if (currentEntry) {
        // Check for Tags line
        const tagsMatch = line.match(/^Tags:\s*(.*)$/i);
        if (tagsMatch) {
          currentEntry.tags = tagsMatch[1]
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
          continue; // Skip adding this line to text
        }

        // Check for Mood line
        const moodMatch = line.match(/^Mood:\s*(.*)$/i);
        if (moodMatch) {
          currentEntry.mood = moodMatch[1].trim();
          continue; // Skip adding this line to text
        }

        // Otherwise, accumulate the entry text
        currentEntry.text += line + "\n";
      }
    }

    // Flush the last entry
    flushEntry();

    // After adding all entries, save and render once
    saveEntries();
    renderEntries();
  };

  const searchEntries = () => {
    const searchText = searchInput.value.trim();
    renderEntries(searchText);
  };

  const getMoodIcon = (mood) => {
    switch (mood.toLowerCase()) {
      case "happy":
        return "😊";
      case "sad":
        return "😢";
      case "excited":
        return "😃";
      case "tired":
        return "😴";
      case "angry":
        return "😠";
      default:
        return "";
    }
  };

  const renderCalendar = (datesToHighlight = []) => {
    // Simple calendar rendering
    calendarDiv.innerHTML = "";

    // Sort dates in descending order
    const uniqueDates = datesToHighlight.sort((a, b) => {
      const dateA = parseDate(a);
      const dateB = parseDate(b);
      return dateB - dateA;
    });

    uniqueDates.forEach((dateString) => {
      const dateDiv = document.createElement("div");
      dateDiv.classList.add("calendar-date");
      dateDiv.textContent = dateString;
      dateDiv.addEventListener("click", () => {
        renderEntries(searchInput.value.trim(), [], dateString);
      });
      calendarDiv.appendChild(dateDiv);
    });
  };

  const updateAnalytics = () => {
    // Collect filtered entries
    const filteredEntries = [];
    const searchText = searchInput.value.trim().toLowerCase();

    entries.forEach((entry) => {
      // Convert entry content to plain text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = entry.content;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";

      // Combine content and tags for searching
      let searchableText = plainText.toLowerCase();

      // Include tags in searchable text
      if (entry.tags && entry.tags.length > 0) {
        searchableText += " " + entry.tags.join(" ").toLowerCase();
      }

      // Apply search filter
      if (searchText && !searchableText.includes(searchText)) {
        return; // Skip this entry if it doesn't match the search
      }

      filteredEntries.push(entry);
    });

    // Entries over time chart
    const entriesPerDate = {};
    filteredEntries.forEach((entry) => {
      const date = formatDate(new Date(entry.date));
      entriesPerDate[date] = (entriesPerDate[date] || 0) + 1;
    });
    const labels = Object.keys(entriesPerDate).sort();
    const data = labels.map((date) => entriesPerDate[date]);

    // Destroy previous chart instance if exists
    if (window.entriesChartInstance) {
      window.entriesChartInstance.destroy();
    }

    window.entriesChartInstance = new Chart(entriesChartCtx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Entries Over Time",
            data,
            borderColor: "#03a9f4",
            backgroundColor: "rgba(3, 169, 244, 0.2)",
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
      },
    });

    // Mood statistics
    const moodCounts = {};
    filteredEntries.forEach((entry) => {
      if (entry.mood) {
        const mood = entry.mood.toLowerCase();
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
      }
    });
    let moodStatsHTML = "<h3>Mood Statistics</h3>";
    for (const mood in moodCounts) {
      moodStatsHTML += `<p>${getMoodIcon(mood)} ${
        mood.charAt(0).toUpperCase() + mood.slice(1)
      }: ${moodCounts[mood]}</p>`;
    }
    moodStatsDiv.innerHTML = moodStatsHTML;
  };

  const setReminder = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted" && !reminderSet) {
          setInterval(() => {
            new Notification("Journal Reminder", {
              body: "Don't forget to write in your journal today!",
            });
          }, 86400000); // Remind every 24 hours
          reminderSet = true;
        }
      });
    } else {
      alert("Browser notifications are not supported in your browser.");
    }
  };

  entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = editor.root.innerHTML.trim();
    const tags = tagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);
    const mood = moodSelect.value;
    if (content) {
      addEntry(content, new Date(), tags, mood);
      editor.root.innerHTML = "";
      tagsInput.value = "";
      moodSelect.value = "";
    }
  });

  exportButton.addEventListener("click", exportEntries);

  loadButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    loadEntries(e.target.files);
  });

  searchInput.addEventListener("input", searchEntries);

  // Function to generate a UUID
  function generateUUID() {
    // Public Domain/MIT
    var d = new Date().getTime(); //Timestamp
    var d2 = (performance && performance.now && performance.now() * 1000) || 0; //Time in microseconds since page-load or 0 if unsupported
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = Math.random() * 16; //random number between 0 and 16
        if (d > 0) {
          r = (d + r) % 16 | 0;
          d = Math.floor(d / 16);
        } else {
          r = (d2 + r) % 16 | 0;
          d2 = Math.floor(d2 / 16);
        }
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  }

  // Initialize Sortable on the entries container
  const sortable = new Sortable(entriesDiv, {
    animation: 150,
    ghostClass: "ghost", // Class for the ghost element
    onEnd: function (evt) {
      // Get the new order of entries
      const newOrder = Array.from(entriesDiv.children).map((child) =>
        child.getAttribute("data-id")
      );

      // Reorder the entries array based on the new order
      entries = newOrder.map((id) => entries.find((entry) => entry.id === id));

      // Save and re-render entries
      saveEntries();
      renderEntries();
    },
  });

  setReminder();
  renderEntries();
});
