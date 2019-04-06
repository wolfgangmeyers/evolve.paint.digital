import * as React from "react";
import { NavLink } from "react-router-dom";


export interface MenuProps {
    
}

export class Menu extends React.Component<MenuProps> {

    render() {
        return <div className="card border-primary mb-3">
            <div className="card-header">
                evolve.paint.digital
                <NavLink className="nav-link" activeClassName="active" to="/classic">
                    Classic Evolver
                </NavLink>
                <NavLink className="nav-link" activeClassName="active" to="/multi">
                    Multi Evolver
                </NavLink>
            </div>
            <div className="card-body">
                {this.props.children}
            </div>
        </div>;
    }
}