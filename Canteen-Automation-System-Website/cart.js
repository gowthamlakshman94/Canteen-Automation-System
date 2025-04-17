if (document.readyState == "loading") {
    document.addEventListener("DOMContentLoaded", ready);
} else {
    ready();
}

function ready() {
    // Ensure remove button event listeners are attached only if the elements exist
    var removeCartItemButtons = document.getElementsByClassName("removeBtn");
    if (removeCartItemButtons.length > 0) {
        for (var i = 0; i < removeCartItemButtons.length; i++) {
            var button = removeCartItemButtons[i];
            button.addEventListener("click", removeCartItem);
        }
    }

    // Ensure add to cart button event listeners are attached
    var addToCartButtons = document.getElementsByClassName("addToCartbutton");
    if (addToCartButtons.length > 0) {
        for (var i = 0; i < addToCartButtons.length; i++) {
            var button = addToCartButtons[i];
            button.addEventListener("click", addToCartClicked);
        }
    }

    // Ensure purchase button exists before attaching event listener
    var purchaseBtn = document.getElementsByClassName("purchaseBtn")[0];
    if (purchaseBtn) {
        purchaseBtn.addEventListener("click", purchaseClicked);
    }
}

function purchaseClicked() {
    alert("Thank you for Shopping here!!");
    var cartItems = document.getElementsByClassName("cartItems")[0];
    updateCartTotal();

    // Prepare order data and submit the order
    var orderData = prepareOrderData();
    if (orderData) {
        submitOrder(orderData);
    }
	
	while (cartItems.hasChildNodes()) {
        cartItems.removeChild(cartItems.firstChild);
    }	

}

function removeCartItem(event) {
    var buttonClicked = event.target;
    buttonClicked.parentElement.parentElement.remove();
    updateCartTotal();
}

function quantityChanged(event) {
    var input = event.target;
    if (isNaN(input.value) || input.value <= 0) {
        input.value = 1;
    }
    updateCartTotal();
}

function addToCartClicked(event) {
    var button = event.target;
    var shopItem = button.parentElement.parentElement.parentElement;
    var title = shopItem.getElementsByClassName("item-title")[0].innerText;
    var price = shopItem.getElementsByClassName("item-price")[0].innerText;
    var imageSrc = shopItem.getElementsByClassName("item-image")[0].src;
    addItemToCart(title, price, imageSrc);
    updateCartTotal();
}

function addItemToCart(title, price, imageSrc) {
    var cartRow = document.createElement("div");
    cartRow.classList.add("cart-row");
    var cartItems = document.getElementsByClassName("cartItems")[0];
    var cartItemNames = cartItems.getElementsByClassName("cart-item-title");
    for (var i = 0; i < cartItemNames.length; i++) {
        if (cartItemNames[i].innerText == title) {
            alert("This item is already added to the cart");
            return;
        }
    }
    var cartRowContents = `
          <div class="cart-item cart-column">
              <img class="cart-item-image" src="${imageSrc}" width="100" height="100">
              <span class="cart-item-title">${title}</span>
          </div>
          <span class="cart-price cart-column">${price}</span>
          <div class="cart-quantity cart-column">
              <input class="cart-quantity-input" type="number" value="1">
              <button class="removeBtn btn btn-danger" type="button">Remove</button>
          </div>`;
    cartRow.innerHTML = cartRowContents;
    cartItems.append(cartRow);
    cartRow.getElementsByClassName("removeBtn")[0].addEventListener("click", removeCartItem);
    cartRow.getElementsByClassName("cart-quantity-input")[0].addEventListener("change", quantityChanged);
}

function updateCartTotal() {
    var cartItemContainer = document.getElementsByClassName('cartItems')[0];
    var cartRows = cartItemContainer.getElementsByClassName('cart-row');
    var total = 0;
    for (var i = 0; i < cartRows.length; i++) {
        var cartRow = cartRows[i];
        var priceElement = cartRow.getElementsByClassName('cart-price')[0];
        var quantityElement = cartRow.getElementsByClassName('cart-quantity-input')[0];

        // Extract the price and clean it up by removing non-numeric characters
        var priceText = priceElement.innerText.replace(/[^\d.-]/g, ''); // Removes ₹ and other non-numeric characters
        var price = parseFloat(priceText);

        var quantity = parseInt(quantityElement.value);

        if (!isNaN(price) && !isNaN(quantity)) {
            total += price * quantity;
        }
    }

    total = Math.round(total * 100) / 100; // Round to 2 decimal place
    document.getElementsByClassName('cart-total-price')[0].innerHTML = "&#8377;" + total;
}


function prepareOrderData() {
    var cartItems = document.getElementsByClassName("cartItems")[0];
    var cartRows = cartItems.getElementsByClassName("cart-row");
    var items = [];
    var createdAt = new Date().toISOString(); // Current timestamp in ISO format

    // Get userEmail from cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    }

    var userEmail = getCookie("userEmail");

    for (var i = 0; i < cartRows.length; i++) {
        var cartRow = cartRows[i];
        var itemName = cartRow.getElementsByClassName("cart-item-title")[0].innerText;
        var price = cartRow.getElementsByClassName("cart-price")[0].innerText;
        price = parseFloat(price.slice(1));
        var quantity = cartRow.getElementsByClassName("cart-quantity-input")[0].value;

        items.push({
            itemName: itemName,
            price: price,
            quantity: quantity,
            createdAt: createdAt
        });
    }

    if (items.length > 0) {
        var orderId = new Date().getTime(); // Generate order ID
        localStorage.setItem('orderId', orderId); // Store the orderId in localStorage

        return {
            orderId: orderId,
            userEmail: userEmail || "unknown", // fallback in case cookie isn't found
            items: items
        };
    } else {
        alert("Your cart is empty!");
        return null;
    }
}



function submitOrder(orderData) {
    console.log("Submitting order:", orderData);

    fetch('http://localhost:3000/submitOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Order submitted successfully:', data);
        alert('Order submitted successfully!');

        // Save confirmation info for use elsewhere
        localStorage.setItem('orderSubmitted', 'true');
        localStorage.setItem('orderId', data.orderId || 'N/A');

        // Optional: show order info in current page (if you want)
        // document.getElementById("someElement").innerText = "Order ID: " + data.orderId;
    })
    .catch(error => {
        console.error('Error submitting order:', error);
        alert('Error submitting order');
    });
}


