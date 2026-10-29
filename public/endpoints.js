(() => {
  const list = document.getElementById("routes");
  const error = document.getElementById("routes-error");
  if (!list || !error) return;

  fetch("/swagger.json", { headers: { Accept: "application/json" } })
    .then((response) => {
      if (!response.ok) throw new Error("API specification request failed.");
      return response.json();
    })
    .then((spec) => {
      const fragment = document.createDocumentFragment();
      for (const [path, operations] of Object.entries(spec.paths || {})) {
        for (const method of Object.keys(operations || {})) {
          const item = document.createElement("li");
          const methodBadge = document.createElement("span");
          methodBadge.className = `method ${method.toLowerCase()}`;
          methodBadge.textContent = method.toUpperCase();
          const link = document.createElement("a");
          link.className = "endpoint-link";
          link.href = path;
          link.textContent = path;
          item.append(methodBadge, link);
          fragment.appendChild(item);
        }
      }
      list.replaceChildren(fragment);
      if (!fragment.childNodes.length) list.replaceChildren();
    })
    .catch(() => {
      list.replaceChildren();
      error.hidden = false;
    });
})();
