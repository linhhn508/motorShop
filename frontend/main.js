let product_info = [];
const categoryList = [];


const category = document.getElementById("menu");
function displayCategoryMenu() {
    let categoryHTML = `<ul>
        <li class="menu-title">Danh mục sản phẩm</li>`;

    for (let i = 0; i < product_info.length; i++) {
        if (!categoryList.includes(product_info[i].category)) {
            categoryList.push(product_info[i].category);
            categoryHTML += `<li><a href="/">${product_info[i].category}</a></li>`;
        }
    }

    categoryHTML += `</ul>`;
    category.innerHTML = categoryHTML;
}


const itemsPerPage = 10;
let currentPage = 1;

const pageNumbersContainer = document.getElementById("page-numbers");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");



function displayPage(page) {
    const productGrid = document.getElementById("product_list");
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = product_info.slice(startIndex, endIndex);

    productGrid.innerHTML = "";
    paginatedProducts.forEach(product => {
        productGrid.innerHTML += `
            <li style="list-style: none;">
                <div class="product-item">
                    <a href="/">
                        <img src="${product.image}" alt="${product.name}">
                        <h4>${product.name}</h4></a>
                    <p>$${product.price}</p>
                </div>
            </li>
        `;
    });
}

function updatePagination() {
    const totalPages = Math.ceil(product_info.length / itemsPerPage);
    pageNumbersContainer.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = i;
        if (i === currentPage) {
            pageButton.classList.add("active");
        }
        pageButton.addEventListener("click", () => {
            currentPage = i;
            displayPage(currentPage);
            updatePagination();
            updateButtonStates();
        });
        pageNumbersContainer.appendChild(pageButton);
    }
}

function updateButtonStates() {
    const totalPages = Math.ceil(product_info.length / itemsPerPage);
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        displayPage(currentPage);
        updatePagination();
        updateButtonStates();
    }
});

nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(product_info.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayPage(currentPage);
        updatePagination();
        updateButtonStates();
    }
});

async function getProductList() {
  try {
    const response = await fetch('http://192.168.58.128:5000/api/products/');

    if (!response.ok) {
      throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    product_info = data;
        displayCategoryMenu();
        displayPage(currentPage);
        updatePagination();
        updateButtonStates();
  } catch (error) {
    console.error('Có lỗi xảy ra:', error);
  }
}

getProductList()
