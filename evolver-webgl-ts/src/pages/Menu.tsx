import * as React from "react";
import { NavLink } from "react-router-dom";


export interface MenuProps {
    
}

export class Menu extends React.Component<MenuProps> {

    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">
                Digitally Evolved Art
                <NavLink className="nav-link" activeClassName="active" to="/painting-evolver">
                    Painting Evolver
                </NavLink>
            </div>
            <div className="card-body">
                {this.props.children}
            </div>
        </div>;
    }
}
