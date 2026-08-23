const shuffle = (arr) => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const shuffledCreators = shuffle(FEATURED_CREATORS);
const featuredCreatorsContainer = document.getElementById(
  "featured-creators-container",
);

for (const creator of shuffledCreators) {
  const a = document.createElement("a");
  a.className = "featured-content";
  a.href = creator.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.className = "featured-content-img";
  img.src = creator.img;
  img.alt = `${creator.name} logo`;
  img.width = 50;
  img.height = 50;
  img.loading = "lazy";

  const name = document.createElement("span");
  name.className = "featured-content-name";
  name.innerText = creator.name;

  a.appendChild(img);
  a.appendChild(name);

  featuredCreatorsContainer.appendChild(a);
}

const featuredContentContainer = document.getElementById(
  "featured-addons-container",
);
const shuffledFeaturedAddons = shuffle(FEATURED_CONTENT);

for (const addon of shuffledFeaturedAddons) {
  const a = document.createElement("a");
  a.className = "featured-content";
  a.href = addon.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.className = "featured-content-img";
  img.src = addon.img;
  img.alt = `${addon.name} icon`;
  img.width = 50;
  img.height = 50;
  img.loading = "lazy";

  const subcontainer = document.createElement("div");

  const name = document.createElement("span");
  name.className = "featured-content-name";
  name.innerText = addon.name;

  const infoContainer = document.createElement("div");
  infoContainer.className = "featured-content-info-container";

  const author = document.createElement("span");
  author.className = "featured-content-author";
  author.innerText = `by ${addon.author}`;

  const tag = document.createElement("span");
  tag.className = "featured-content-tag";
  if (addon.free) {
    tag.innerText = "Free";
    tag.style.backgroundColor = "green";
  } else {
    tag.innerText = "Paid";
    tag.style.backgroundColor = "goldenrod";
  }

  infoContainer.appendChild(author);
  infoContainer.appendChild(tag);

  subcontainer.appendChild(name);
  subcontainer.appendChild(infoContainer);

  a.appendChild(img);
  a.appendChild(subcontainer);

  featuredContentContainer.appendChild(a);
}
