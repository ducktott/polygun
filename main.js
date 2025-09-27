import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

let camera, scene, renderer, controls;

const objects = [];

let raycaster;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let canDash = true;
const dashCooldown = 1; // seconds
let lastDashTime = 0;

let score = 0;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const vertex = new THREE.Vector3();
const color = new THREE.Color();

const projectiles = [];
const boxHelpers = [];

// Terrain variables
let terrain;
const worldWidth = 256, worldDepth = 256;
const worldHalfWidth = worldWidth / 2;
const worldHalfDepth = worldDepth / 2;
const data = generateHeight( worldWidth, worldDepth );

// Environmental objects
const rocks = [];
const trees = [];

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.y = 10;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x87CEEB ); // Sky blue
    scene.fog = new THREE.Fog( 0x87CEEB, 100, 950 );

    const light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 2.5 );
    light.position.set( 0.5, 1, 0.75 );
    scene.add( light );
    
    // Add directional light for better shadows and depth
    const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.position.set( 100, 100, 50 );
    scene.add( dirLight );

    controls = new PointerLockControls( camera, document.body );

    const blocker = document.createElement('div');
    blocker.id = 'blocker';
    blocker.style.position = 'absolute';
    blocker.style.width = '100%';
    blocker.style.height = '100%';
    blocker.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.width = '100%';
    instructions.style.height = '100%';
    instructions.style.display = 'flex';
    instructions.style.flexDirection = 'column';
    instructions.style.justifyContent = 'center';
    instructions.style.alignItems = 'center';
    instructions.style.textAlign = 'center';
    instructions.style.fontSize = '24px';
    instructions.style.color = 'white';
    instructions.style.cursor = 'pointer';
    instructions.innerHTML = `
        <p>Click to play</p>
        <p>
            Move: WASD<br/>
            Jump: SPACE<br/>
            Dash: LEFT SHIFT<br/>
            Shoot: LEFT CLICK<br/>
            Look: MOUSE
        </p>
    `;

    blocker.appendChild(instructions);
    document.body.appendChild(blocker);


    instructions.addEventListener( 'click', function () {

        controls.lock();

    } );

    controls.addEventListener( 'lock', function () {

        instructions.style.display = 'none';
        blocker.style.display = 'none';

    } );

    controls.addEventListener( 'unlock', function () {

        blocker.style.display = 'block';
        instructions.style.display = '';

    } );

    scene.add( controls.getObject() );

    const onMouseDown = function ( event ) {
        if (controls.isLocked) {
            shoot();
        }
    }

    const onKeyDown = function ( event ) {

        switch ( event.code ) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;

            case 'Space':
                if ( canJump === true ) velocity.y += 350;
                canJump = false;
                break;
            
            case 'ShiftLeft':
                if (canDash) {
                    dash();
                }
                break;

        }

    };

    const onKeyUp = function ( event ) {

        switch ( event.code ) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;

        }

    };



    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );
    document.addEventListener( 'mousedown', onMouseDown);

    raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );

    // Create terrain
    createTerrain();
    
    // Add environmental objects
    addRocks();
    addTrees();
    
    // objects

    for ( let i = 0; i < 100; i ++ ) {
        createEnemy();
    }


    //

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    //

    window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

// Get terrain height at any world position with bilinear interpolation
function getTerrainHeight(worldX, worldZ) {
    // Convert world coordinates to terrain grid coordinates
    const terrainX = (worldX + 3750) / 7500 * (worldWidth - 1);
    const terrainZ = (worldZ + 3750) / 7500 * (worldDepth - 1);
    
    // Get the four surrounding grid points
    const x0 = Math.floor(terrainX);
    const x1 = Math.ceil(terrainX);
    const z0 = Math.floor(terrainZ);
    const z1 = Math.ceil(terrainZ);
    
    // Clamp to terrain bounds
    const x0Clamped = Math.max(0, Math.min(x0, worldWidth - 1));
    const x1Clamped = Math.max(0, Math.min(x1, worldWidth - 1));
    const z0Clamped = Math.max(0, Math.min(z0, worldDepth - 1));
    const z1Clamped = Math.max(0, Math.min(z1, worldDepth - 1));
    
    // Get heights at the four corners
    const h00 = data[z0Clamped * worldWidth + x0Clamped] * 10;
    const h10 = data[z0Clamped * worldWidth + x1Clamped] * 10;
    const h01 = data[z1Clamped * worldWidth + x0Clamped] * 10;
    const h11 = data[z1Clamped * worldWidth + x1Clamped] * 10;
    
    // Bilinear interpolation
    const fx = terrainX - x0;
    const fz = terrainZ - z0;
    
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
}

function generateHeight( width, height ) {
    const size = width * height;
    const data = new Uint8Array( size );
    const perlin = new ImprovedNoise();
    const z = Math.random() * 100;

    let quality = 1;

    // Generate smoother terrain with multiple octaves
    for ( let j = 0; j < 4; j ++ ) {
        for ( let i = 0; i < size; i ++ ) {
            const x = i % width;
            const y = ~ ~ ( i / width );
            // Use regular noise instead of absolute value for smoother terrain
            if (j === 0) {
                // Base layer - large features
                data[ i ] += (perlin.noise( x / quality, y / quality, z ) + 0.5) * quality * 2.5;
            } else {
                // Detail layers
                data[ i ] += Math.abs( perlin.noise( x / quality, y / quality, z ) * quality * 0.5 );
            }
        }
        quality *= 4;
    }
    
    // Smooth the terrain slightly to avoid sharp edges
    const smoothedData = new Uint8Array( size );
    for ( let i = 0; i < size; i ++ ) {
        const x = i % width;
        const y = ~ ~ ( i / width );
        
        let sum = data[i];
        let count = 1;
        
        // Average with neighbors for smoothing
        if (x > 0) { sum += data[i - 1]; count++; }
        if (x < width - 1) { sum += data[i + 1]; count++; }
        if (y > 0) { sum += data[i - width]; count++; }
        if (y < height - 1) { sum += data[i + width]; count++; }
        
        smoothedData[i] = sum / count;
    }

    return smoothedData;
}

function createTerrain() {
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry( 7500, 7500, worldWidth - 1, worldDepth - 1 );
    geometry.rotateX( - Math.PI / 2 );

    const vertices = geometry.attributes.position.array;

    for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
        vertices[ j + 1 ] = data[ i ] * 10;
    }

    geometry.computeVertexNormals();

    // Create terrain texture with height-based coloring
    const colors = [];
    const color = new THREE.Color();
    
    for ( let i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
        const height = vertices[ j + 1 ];
        
        if ( height < 100 ) {
            // Low areas - grass green
            color.setHSL( 0.3, 0.7, 0.5 );
        } else if ( height < 200 ) {
            // Mid areas - brown/dirt
            color.setHSL( 0.1, 0.5, 0.4 );
        } else if ( height < 350 ) {
            // High areas - rocky gray
            color.setHSL( 0, 0, 0.5 );
        } else {
            // Peaks - snow white
            color.setHSL( 0, 0, 0.9 );
        }
        
        colors.push( color.r, color.g, color.b );
    }

    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

    const material = new THREE.MeshLambertMaterial( { 
        vertexColors: true,
        side: THREE.DoubleSide
    });

    terrain = new THREE.Mesh( geometry, material );
    scene.add( terrain );
}

function addRocks() {
    const rockGeometry1 = new THREE.DodecahedronGeometry( 15, 0 );
    const rockGeometry2 = new THREE.OctahedronGeometry( 20, 0 );
    const rockGeometry3 = new THREE.IcosahedronGeometry( 12, 0 );
    
    const rockMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x666666,
        flatShading: true 
    });

    for ( let i = 0; i < 50; i ++ ) {
        let rockGeometry;
        const type = Math.floor(Math.random() * 3);
        
        switch(type) {
            case 0:
                rockGeometry = rockGeometry1.clone();
                break;
            case 1:
                rockGeometry = rockGeometry2.clone();
                break;
            case 2:
                rockGeometry = rockGeometry3.clone();
                break;
        }
        
        const rock = new THREE.Mesh( rockGeometry, rockMaterial );
        
        // Random position
        rock.position.x = Math.random() * 3000 - 1500;
        rock.position.z = Math.random() * 3000 - 1500;
        
        // Get terrain height at this position using interpolation
        rock.position.y = getTerrainHeight(rock.position.x, rock.position.z);
        
        // Random rotation and scale
        rock.rotation.x = Math.random() * Math.PI;
        rock.rotation.y = Math.random() * Math.PI;
        rock.rotation.z = Math.random() * Math.PI;
        
        const scale = 0.5 + Math.random() * 1.5;
        rock.scale.set(scale, scale, scale);
        
        scene.add( rock );
        rocks.push( rock );
    }
}

function addTrees() {
    const trunkGeometry = new THREE.CylinderGeometry( 5, 8, 40, 8 );
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    
    const leavesGeometry1 = new THREE.ConeGeometry( 25, 40, 8 );
    const leavesGeometry2 = new THREE.ConeGeometry( 20, 30, 8 );
    const leavesGeometry3 = new THREE.ConeGeometry( 15, 20, 8 );
    const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });

    for ( let i = 0; i < 100; i ++ ) {
        const tree = new THREE.Group();
        
        // Trunk
        const trunk = new THREE.Mesh( trunkGeometry, trunkMaterial );
        trunk.position.y = 20;
        tree.add( trunk );
        
        // Three layers of leaves for pine tree effect
        const leaves1 = new THREE.Mesh( leavesGeometry1, leavesMaterial );
        leaves1.position.y = 40;
        tree.add( leaves1 );
        
        const leaves2 = new THREE.Mesh( leavesGeometry2, leavesMaterial );
        leaves2.position.y = 55;
        tree.add( leaves2 );
        
        const leaves3 = new THREE.Mesh( leavesGeometry3, leavesMaterial );
        leaves3.position.y = 70;
        tree.add( leaves3 );
        
        // Random position
        tree.position.x = Math.random() * 3000 - 1500;
        tree.position.z = Math.random() * 3000 - 1500;
        
        // Get terrain height at this position using interpolation
        tree.position.y = getTerrainHeight(tree.position.x, tree.position.z);
        
        // Only place trees at lower elevations
        if (tree.position.y < 150) {
            // Random rotation (only Y axis for trees)
            tree.rotation.y = Math.random() * Math.PI * 2;
            
            // Random scale
            const scale = 0.8 + Math.random() * 0.6;
            tree.scale.set(scale, scale, scale);
            
            scene.add( tree );
            trees.push( tree );
        }
    }
}

function createEnemy() {
    const enemy = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CylinderGeometry(5, 5, 20, 8);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 10;
    enemy.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(5, 8, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0xffd2a6 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 25;
    enemy.add(head);

    // Hat
    const hatGeometry = new THREE.CylinderGeometry(7, 7, 2, 8);
    const hatMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = 29;
    enemy.add(hat);
    
    const hatBrimGeometry = new THREE.CylinderGeometry(9, 9, 1, 8);
    const hatBrim = new THREE.Mesh(hatBrimGeometry, hatMaterial);
    hatBrim.position.y = 28;
    enemy.add(hatBrim);


    enemy.position.x = Math.floor( Math.random() * 20 - 10 ) * 20;
    enemy.position.z = Math.floor( Math.random() * 20 - 10 ) * 20;
    
    // Place enemy on terrain with proper height
    enemy.position.y = getTerrainHeight(enemy.position.x, enemy.position.z) + 15; // Add height offset for enemy base

    enemy.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
    );
    
    // Add vertical velocity for gravity
    enemy.velocityY = 0;
    enemy.canJump = true;

    scene.add( enemy );
    objects.push( enemy );

    const boxHelper = new THREE.BoxHelper(enemy, 0xff0000);
    boxHelper.visible = false;
    scene.add(boxHelper);
    boxHelpers.push(boxHelper);
}

function dash() {
    canDash = false;
    lastDashTime = performance.now();
    
    const dashSpeed = 400;
    
    // Calculate dash direction based on current movement keys
    const dashDirection = new THREE.Vector3();
    dashDirection.z = Number( moveForward ) - Number( moveBackward );
    dashDirection.x = Number( moveRight ) - Number( moveLeft );
    
    if (dashDirection.lengthSq() === 0) {
        // If no movement keys are pressed, dash forward
        camera.getWorldDirection(dashDirection);
        dashDirection.y = 0; // Don't dash up/down
    }
    
    dashDirection.normalize();

    velocity.z += dashDirection.z * dashSpeed;
    velocity.x += dashDirection.x * dashSpeed;
}

function shoot() {
    const projectileGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    projectile.position.copy(camera.position);
    
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    projectile.velocity = direction.multiplyScalar(500);

    projectiles.push(projectile);
    scene.add(projectile);
}

function animate() {

    requestAnimationFrame( animate );

    const time = performance.now();
    const delta = ( time - prevTime ) / 1000;

    // Cooldowns
    if (!canDash) {
        if ((time - lastDashTime) / 1000 > dashCooldown) {
            canDash = true;
            document.getElementById('crosshair').style.borderColor = 'white';
        } else {
            document.getElementById('crosshair').style.borderColor = 'red';
        }
    }

    if ( controls.isLocked === true ) {

        raycaster.ray.origin.copy( controls.getObject().position );
        raycaster.ray.origin.y -= 10;

        const intersections = raycaster.intersectObjects( objects, false );

        const onObject = intersections.length > 0;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number( moveForward ) - Number( moveBackward );
        direction.x = Number( moveRight ) - Number( moveLeft );
        direction.normalize(); // this ensures consistent movements in all directions

        if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta;
        if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta;

        if ( onObject === true ) {

            velocity.y = Math.max( 0, velocity.y );
            canJump = true;

        }

        controls.moveRight( - velocity.x * delta );
        controls.moveForward( - velocity.z * delta );

        controls.getObject().position.y += ( velocity.y * delta ); // new behavior

        // Get terrain height at player position with interpolation
        const terrainHeight = getTerrainHeight(
            controls.getObject().position.x, 
            controls.getObject().position.z
        ) + 10; // Add 10 for player height above ground
        
        // Check if player is on or below terrain
        if ( controls.getObject().position.y <= terrainHeight ) {
            
            // If falling, stop at terrain surface
            if (velocity.y < 0) {
                velocity.y = 0;
                controls.getObject().position.y = terrainHeight;
                canJump = true;
            }
            // If somehow below terrain, push up
            else if (controls.getObject().position.y < terrainHeight) {
                controls.getObject().position.y = terrainHeight;
                velocity.y = 0;
                canJump = true;
            }
        }

    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.position.add(projectile.velocity.clone().multiplyScalar(delta));

        // Remove projectile if it's too far
        if (projectile.position.length() > 1000) {
            scene.remove(projectile);
            projectiles.splice(i, 1);
            continue;
        }

        // Collision detection
        for (let j = objects.length - 1; j >= 0; j--) {
            const box = objects[j];
            if (projectile.position.distanceTo(box.position) < 30) { 
                scene.remove(projectile);
                projectiles.splice(i, 1);
                
                scene.remove(box);
                objects.splice(j, 1);
                boxHelpers.splice(j, 1);

                score++;
                document.getElementById('score').innerText = 'Score: ' + score;
                
                // Spawn a new enemy to replace the destroyed one
                createEnemy();

                break; 
            }
        }
    }

    // Update enemies with physics
    const playAreaSize = 1000;
    for (let i = 0; i < objects.length; i++) {
        const enemy = objects[i];
        
        // Apply gravity
        enemy.velocityY -= 9.8 * 50.0 * delta; // gravity
        
        // Update horizontal position
        const horizontalMovement = enemy.velocity.clone().multiplyScalar(delta);
        enemy.position.x += horizontalMovement.x;
        enemy.position.z += horizontalMovement.z;
        
        // Update vertical position
        enemy.position.y += enemy.velocityY * delta;
        
        // Get terrain height at enemy position with interpolation
        const terrainHeightAtEnemy = getTerrainHeight(enemy.position.x, enemy.position.z);
        
        // Check if enemy is on or below terrain (with offset for enemy height)
        const enemyGroundLevel = terrainHeightAtEnemy + 0; // Enemy base should be at terrain level
        
        if (enemy.position.y <= enemyGroundLevel) {
            enemy.position.y = enemyGroundLevel;
            enemy.velocityY = 0;
            enemy.canJump = true;
            
            // Randomly make enemy jump sometimes (to navigate terrain)
            if (Math.random() < 0.005 && enemy.canJump) {
                enemy.velocityY = 150 + Math.random() * 100;
                enemy.canJump = false;
            }
        }
        else {
            enemy.canJump = false;
        }
        
        // Apply friction to horizontal movement when on ground
        if (enemy.canJump) {
            enemy.velocity.x *= 0.98;
            enemy.velocity.z *= 0.98;
            
            // Add small random movement to make enemies more dynamic
            if (Math.random() < 0.02) {
                enemy.velocity.x += (Math.random() - 0.5) * 30;
                enemy.velocity.z += (Math.random() - 0.5) * 30;
            }
        }

        // Bounce off walls and maintain some speed
        if (enemy.position.x > playAreaSize || enemy.position.x < -playAreaSize) {
            enemy.velocity.x *= -1;
            enemy.position.x = Math.max(-playAreaSize, Math.min(playAreaSize, enemy.position.x));
        }
        if (enemy.position.z > playAreaSize || enemy.position.z < -playAreaSize) {
            enemy.velocity.z *= -1;
            enemy.position.z = Math.max(-playAreaSize, Math.min(playAreaSize, enemy.position.z));
        }
        
        // Ensure minimum speed for enemies
        const speed = Math.sqrt(enemy.velocity.x * enemy.velocity.x + enemy.velocity.z * enemy.velocity.z);
        if (speed < 20 && enemy.canJump) {
            const angle = Math.random() * Math.PI * 2;
            enemy.velocity.x = Math.cos(angle) * 30;
            enemy.velocity.z = Math.sin(angle) * 30;
        }

        boxHelpers[i].update();
    }


    prevTime = time;

    renderer.render( scene, camera );

}
