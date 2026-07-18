const productId = window.location.pathname.split('/').pop()

function displayCategoryMenu(categories) {
    const categoryList = [];
    const category = document.getElementById("menu");
    let categoryHTML = `<ul>
        <li class="menu-title">Danh mục sản phẩm</li>`;

    for (let i = 0; i < categories.length; i++) {
        if (!categoryList.includes(categories[i])) {
            categoryList.push(categories[i]);
            categoryHTML += `<li><a href="/">${categories[i]}</a></li>`;
        }
    }

    categoryHTML += `</ul>`;
    category.innerHTML = categoryHTML;
}


async function getCategoryList() {
  try {
    const response = await fetch('/api/products/categories/');

    if (!response.ok) {
      throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
    }

    const categoryList = await response.json();
    displayCategoryMenu(categoryList);
        
  } catch (error) {
    console.error('Có lỗi xảy ra:', error);
  }
}


function displayProductInfo(productInfo) {
    const overallInfo = document.getElementById("overall-info");
    const detailedInfo = document.getElementById("detailed-info");
    const productHeader = document.getElementById("product_info_header");
    const productImage = document.getElementById("product_image");
    
    productHeader.innerHTML = `
        <h3><a href="/">Trang chủ</a>&raquo; ${productInfo.name}</h3>
    `;

    productImage.innerHTML = `
        <img src="/image/product/${productInfo.id}/thumbnail.png" alt="${productInfo.name}">
    `;

    overallInfo.innerHTML = `
        <h3>${productInfo.name}</h3>
        <p>
          <strong>Giá:</strong> ${productInfo.price} VNĐ<br>
          <strong>Tình trạng:</strong> Còn hàng<br>
          <strong>Hãng sản xuất:</strong> ${productInfo.product.overall.brand}<br>
          <strong>Xuất xứ:</strong> ${productInfo.product.overall.made_in}<br>
          <strong>Chất liệu:</strong> ${productInfo.product.overall.material}<br>
          <strong>Màu sắc:</strong> ${productInfo.product.overall.color}<br>
        </p>
        <button class="add-to-cart-btn">MUA NGAY VỚI GIÁ ${productInfo.price} VNĐ<br>Đặt mua giao hàng tận nơi</button>
    `;

    detailedInfo.innerHTML = `
        <p>
            ${productInfo.product.detail}
        </p>
    `;
}

async function getProductInfo() {
  try {
    

    const response = await fetch(`/api/products/${productId}/info`);

    if (!response.ok) {
      throw new Error(`Lỗi HTTP! Trạng thái: ${response.status}`);
    }


    const productInfo = await response.json();
    displayProductInfo(productInfo);
        
  } catch (error) {
    console.error('Có lỗi xảy ra:', error);
  }
}
getProductInfo()
getCategoryList()